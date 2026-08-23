import { Request, Response, NextFunction } from "express";
import passport from "passport";
import mongoose from "mongoose";
import "express-session";
import { logger } from "../util/logger";
import httpResponse from "../util/httpResponse";
import httpError from "../util/httpError";
import responseMessage from "../constant/responseMessage";
import { userDocument } from "../model/users";
import { createAccessToken, createRefreshToken, getClientIp, getUserAgent } from "../config/jwt";
import { generateUniqueId } from "../util/crypto";
import { EApplicationEnvironment } from "../constant/application";
import { refreshTokens } from "../model/refreshTokens";

// Extend the Express session type to include custom fields for user authentication
declare module "express-session" {
    interface SessionData {
        userId?: string;
        authSessionId?: string;
        ip?: string;
        userAgent?: string;
    }
}

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        logger.info("Request received in login function", {
            meta: {
                "req.body": req.body,
            },
        });

        // --------------------------------------------------
        // 1. Authenticate user with Passport
        // --------------------------------------------------

        const user = await new Promise<userDocument>((resolve, reject) => {
            passport.authenticate("local", (err: Error | null, authenticatedUser: userDocument | false, info: { message: string } | undefined) => {
                if (err) {
                    logger.error("Error occurred during user authentication", {
                        meta: {
                            err,
                        },
                    });

                    return reject(err);
                }

                if (!authenticatedUser) {
                    logger.warn("User authentication failed", {
                        meta: {
                            info,
                        },
                    });

                    return reject(new Error(`Authentication failed: ${info?.message ?? "Invalid credentials"}`));
                }

                resolve(authenticatedUser);
            })(req, res, next);
        });

        // --------------------------------------------------
        // 2. Start a Mongoose session for transaction management
        // --------------------------------------------------

        const mongooseSession = await mongoose.startSession();

        let transactionCommitted = false;

        try {
            const authenticatedUser = user.toObject();

            const userId = authenticatedUser._id.toString();

            // This is YOUR application-level device/session ID.
            const authSessionId = generateUniqueId();

            const ip = getClientIp(req);

            const userAgent = getUserAgent(req);

            // --------------------------------------------------
            // 3. Establish Passport session
            // --------------------------------------------------

            await new Promise<void>((resolve, reject) => {
                req.logIn(user, (loginErr) => {
                    if (loginErr) {
                        logger.error("Error occurred during Passport session establishment", {
                            meta: {
                                loginErr,
                            },
                        });

                        return reject(loginErr);
                    }

                    resolve();
                });
            });

            // --------------------------------------------------
            // 4. Add custom fields to Express session
            // --------------------------------------------------

            req.session.userId = userId;

            req.session.authSessionId = authSessionId;

            req.session.ip = ip;

            req.session.userAgent = userAgent;

            // --------------------------------------------------
            // 5. Explicitly persist Express session
            // --------------------------------------------------

            await new Promise<void>((resolve, reject) => {
                req.session.save((sessionError) => {
                    if (sessionError) {
                        logger.error("Error occurred while saving Express session", {
                            meta: {
                                sessionError,
                                userId,
                                authSessionId,
                            },
                        });

                        return reject(sessionError);
                    }

                    resolve();
                });
            });

            logger.info("Express session saved successfully", {
                meta: {
                    userId,
                    authSessionId,
                    sessionId: req.sessionID,
                },
            });

            // --------------------------------------------------
            // 6. Start MongoDB transaction
            // --------------------------------------------------

            mongooseSession.startTransaction();

            // --------------------------------------------------
            // 7. Create refresh token
            // --------------------------------------------------

            const refreshToken = await createRefreshToken({
                userId,
                sessionId: authSessionId,
                expressSessionId: req.sessionID,
                ip,
                userAgent,
                mongooseSession,
            });

            logger.info("Refresh token created successfully", {
                meta: {
                    userId,
                    authSessionId,
                    ip,
                    userAgent,
                },
            });

            // --------------------------------------------------
            // 8. Create access token
            // --------------------------------------------------

            const accessToken = await createAccessToken({
                userId,
                username: authenticatedUser.username,
                sessionId: authSessionId,
            });

            logger.info("Access token created successfully", {
                meta: {
                    userId,
                    authSessionId,
                },
            });

            // --------------------------------------------------
            // 9. Commit database transaction
            // --------------------------------------------------

            await mongooseSession.commitTransaction();

            transactionCommitted = true;

            logger.info("Login transaction committed successfully", {
                meta: {
                    userId,
                    authSessionId,
                },
            });

            // --------------------------------------------------
            // 10. Close MongoDB transaction session
            // --------------------------------------------------

            await mongooseSession.endSession();

            // --------------------------------------------------
            // 11. Set refresh token cookie
            // --------------------------------------------------

            res.cookie("refreshToken", refreshToken.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION,
                path: "/",
                sameSite: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION ? "none" : "lax",
                expires: new Date(refreshToken.expiresAt),
            });

            logger.info("Refresh token cookie set successfully", {
                meta: {
                    userId,
                    authSessionId,
                },
            });

            // --------------------------------------------------
            // 12. Login successful
            // --------------------------------------------------

            logger.info("User logged in successfully", {
                meta: {
                    userId,
                    authSessionId,
                    expressSessionId: req.sessionID,
                },
            });

            // --------------------------------------------------
            // 13. Send response
            // --------------------------------------------------

            return httpResponse(req, res, responseMessage.SUCCESS, {
                user: {
                    _id: userId,
                    username: authenticatedUser.username,
                },
                accessToken,
            });
        } catch (err) {
            // --------------------------------------------------
            // Rollback MongoDB transaction if necessary
            // --------------------------------------------------

            if (!transactionCommitted) {
                try {
                    await mongooseSession.abortTransaction();
                } catch (abortError) {
                    logger.error("Failed to abort login transaction", {
                        meta: {
                            abortError,
                        },
                    });
                }
            }

            logger.error("Error occurred while logging in", {
                meta: {
                    err,
                },
            });

            // --------------------------------------------------
            // Destroy Passport/Express session if login failed
            // --------------------------------------------------

            if (req.session) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        req.session.destroy((sessionError) => {
                            if (sessionError) {
                                return reject(sessionError);
                            }

                            resolve();
                        });
                    });
                } catch (sessionDestroyError) {
                    logger.error("Failed to destroy Express session after login failure", {
                        meta: {
                            sessionDestroyError,
                        },
                    });
                }
            }

            // --------------------------------------------------
            // Clear refresh token cookie
            // --------------------------------------------------

            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION,
                path: "/",
                sameSite: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION ? "none" : "lax",
            });

            return httpError(next, req, err as Error, responseMessage.SOME_ERROR_OCCURRED);
        } finally {
            // --------------------------------------------------
            // Always close MongoDB session
            // --------------------------------------------------

            if (!mongooseSession.hasEnded) {
                await mongooseSession.endSession();
            }
        }
    } catch (error) {
        logger.error("Exception occurred in login function", {
            meta: {
                error,
            },
        });

        return httpError(next, req, error as Error, responseMessage.SOME_ERROR_OCCURRED);
    }
};

type LogoutType = "current" | "selected" | "all";

interface LogoutRequestBody {
    type: LogoutType;
    sessionIds?: string[];
}

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // --------------------------------------------------
        // 1. Make sure user is authenticated
        // --------------------------------------------------

        const user = req.user as userDocument | undefined;

        if (!user) {
            return httpError(next, req, new Error("User is not authenticated"), responseMessage.UNAUTHORIZED);
        }

        const userId = user._id.toString();

        const { type, sessionIds } = req.body as LogoutRequestBody;

        logger.info("Logout request received", {
            meta: {
                userId,
                type,
                sessionIds,
                expressSessionId: req.sessionID,
                authSessionId: req.session.authSessionId,
            },
        });

        // --------------------------------------------------
        // 2. Validate logout type
        // --------------------------------------------------

        if (!["current", "selected", "all"].includes(type)) {
            return httpError(next, req, new Error("Invalid logout type"), responseMessage.BAD_REQUEST);
        }

        // --------------------------------------------------
        // 3. Validate selected session IDs
        // --------------------------------------------------

        if (type === "selected") {
            if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
                return httpError(next, req, new Error("sessionIds are required for selected logout"), responseMessage.BAD_REQUEST);
            }

            if (sessionIds.length > 20) {
                return httpError(next, req, new Error("You can logout a maximum of 20 sessions at once"), responseMessage.BAD_REQUEST);
            }

            // Remove duplicates
            req.body.sessionIds = [...new Set(sessionIds)];
        }

        // --------------------------------------------------
        // 4. Determine which application sessions to revoke
        // --------------------------------------------------

        let refreshTokenSessions: Array<{
            _id: mongoose.Types.ObjectId;
            sessionId: string;
            expressSessionId?: string;
        }> = [];

        if (type === "current") {
            const currentAuthSessionId = req.session.authSessionId;

            if (!currentAuthSessionId) {
                return httpError(next, req, new Error("Current authentication session could not be identified"), responseMessage.UNAUTHORIZED);
            }

            const currentSession = await refreshTokens
                .findOne({
                    userId,
                    sessionId: currentAuthSessionId,
                    revokedAt: null,
                })
                .select("_id sessionId expressSessionId")
                .lean();

            if (currentSession) {
                refreshTokenSessions = [currentSession];
            }
        }

        if (type === "selected") {
            refreshTokenSessions = await refreshTokens
                .find({
                    userId,
                    sessionId: {
                        $in: sessionIds ?? [],
                    },
                    revokedAt: null,
                })
                .select("_id sessionId expressSessionId")
                .lean();
        }

        if (type === "all") {
            refreshTokenSessions = await refreshTokens
                .find({
                    userId,
                    revokedAt: null,
                })
                .select("_id sessionId expressSessionId")
                .lean();
        }

        // --------------------------------------------------
        // 5. Extract application session IDs
        // --------------------------------------------------

        const authSessionIds = refreshTokenSessions.map((session) => session.sessionId);

        const expressSessionIds = refreshTokenSessions
            .map((session) => session.expressSessionId)
            .filter((sessionId): sessionId is string => Boolean(sessionId));

        logger.info("Sessions identified for logout", {
            meta: {
                userId,
                type,
                authSessionIds,
                expressSessionIds,
            },
        });

        // --------------------------------------------------
        // 6. Revoke refresh-token sessions
        // --------------------------------------------------

        if (authSessionIds.length > 0) {
            const result = await refreshTokens.updateMany(
                {
                    userId,
                    sessionId: {
                        $in: authSessionIds,
                    },
                    revokedAt: null,
                },
                {
                    $set: {
                        revokedAt: new Date(),
                    },
                }
            );

            logger.info("Refresh-token sessions revoked successfully", {
                meta: {
                    userId,
                    type,
                    revokedCount: result.modifiedCount,
                },
            });
        }

        // --------------------------------------------------
        // 7. Destroy corresponding connect-mongo sessions
        // --------------------------------------------------

        const sessionStore = req.sessionStore;

        const destroySession = (sessionId: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                sessionStore.destroy(sessionId, (err) => {
                    if (err) {
                        return reject(err);
                    }

                    resolve();
                });
            });
        };

        const destroyResults = await Promise.allSettled(expressSessionIds.map((expressSessionId) => destroySession(expressSessionId)));

        const failedSessionDestructions = destroyResults.filter((result) => result.status === "rejected");

        if (failedSessionDestructions.length > 0) {
            logger.error("Some Passport sessions could not be destroyed", {
                meta: {
                    userId,
                    type,
                    failedCount: failedSessionDestructions.length,
                    errors: failedSessionDestructions.map((result) => (result.status === "rejected" ? result.reason : undefined)),
                },
            });
        }

        // --------------------------------------------------
        // 8. Destroy current Express session
        // --------------------------------------------------

        /*
         * This is particularly important for the current
         * browser. It removes the current Passport session
         * from connect-mongo and clears the session cookie.
         *
         * For "all" and "selected", the current session may
         * already have been destroyed above. Calling destroy()
         * again is harmless.
         */

        const currentExpressSessionId = req.sessionID;

        if (type === "current" || expressSessionIds.includes(currentExpressSessionId)) {
            await new Promise<void>((resolve, reject) => {
                req.session.destroy((err) => {
                    if (err) {
                        return reject(err);
                    }

                    resolve();
                });
            });
        }

        // --------------------------------------------------
        // 9. Clear current browser cookies
        // --------------------------------------------------

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION,
            path: "/",
            sameSite: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION ? "none" : "lax",
        });

        res.clearCookie("connect.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION,
            path: "/",
            sameSite: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION ? "none" : "lax",
        });

        // --------------------------------------------------
        // 10. Response
        // --------------------------------------------------

        logger.info("Logout completed successfully", {
            meta: {
                userId,
                type,
                revokedSessions: authSessionIds.length,
                destroyedPassportSessions: expressSessionIds.length,
                failedPassportSessions: failedSessionDestructions.length,
            },
        });

        return httpResponse(req, res, responseMessage.SUCCESS, {
            message: "Logout successful",
            type,
            sessionsLoggedOut: authSessionIds.length,
        });
    } catch (error) {
        logger.error("Exception occurred during logout", {
            meta: {
                error,
            },
        });

        return httpError(next, req, error as Error, responseMessage.SOME_ERROR_OCCURRED);
    }
};
