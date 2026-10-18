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
import { randomInt, createHash, randomUUID, timingSafeEqual } from "crypto";
import { config } from "../config/config";
import redisService from "./redis/redisService";
import { requestMicroservice } from "./microserviceConnector";
import { Users } from "../model/users";

// Extend the Express session type to include custom fields for user authentication
declare module "express-session" {
    interface SessionData {
        userId?: string;
        authSessionId?: string;
        ip?: string;
        userAgent?: string;
    }
}

const completeLogin = async (req: Request, res: Response, next: NextFunction, user: userDocument): Promise<void> => {
    try {
        logger.info("Completing verified login", { meta: { userId: user._id.toString() } });
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

const OTP_TTL_SECONDS = 5 * 60;
const otpDigest = (challengeId: string, otp: string): Buffer => createHash("sha256").update(`${challengeId}:${otp}`).digest();

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = await new Promise<userDocument>((resolve, reject) => {
            passport.authenticate("local", (err: Error | null, authenticatedUser: userDocument | false, info: { message: string } | undefined) => {
                if (err) return reject(err);
                if (!authenticatedUser) return reject(new Error(`Authentication failed: ${info?.message ?? "Invalid credentials"}`));
                resolve(authenticatedUser);
            })(req, res, next);
        });

        const redis = redisService.getClient();
        if (!redis?.isOpen) throw new Error("Redis is unavailable for login verification");

        const userData = user.toObject();
        const challengeId = randomUUID();
        const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
        const cacheKey = `auth:login-otp:${challengeId}`;
        const digest = otpDigest(challengeId, otp).toString("hex");
        await redis.set(cacheKey, JSON.stringify({ userId: user._id.toString(), digest, attempts: 0 }), { EX: OTP_TTL_SECONDS });

        try {
            await requestMicroservice(
                {
                    host: config.NOTIFICATION_SERVICE_HOST,
                    port: config.NOTIFICATION_SERVICE_PORT,
                    ssl: config.NOTIFICATION_SERVICE_SSL,
                    path: config.NOTIFICATION_SERVICE_PATH,
                },
                {
                    method: "POST",
                    body: {
                        channel: "email",
                        templateId: "login_otp",
                        recipient: { email: userData.email, name: userData.firstName },
                        data: { otp, userName: userData.firstName, supportEmail: config.SUPPORT_EMAIL },
                        correlationId: challengeId,
                        metadata: { source: "auth-service" },
                    },
                }
            );
        } catch (error) {
            await redis.del(cacheKey);
            throw error;
        }

        return httpResponse(req, res, responseMessage.ACCEPTED, {
            message: "A verification code has been sent to your email.",
            challengeId,
            expiresIn: OTP_TTL_SECONDS,
        });
    } catch (error) {
        logger.error("Exception occurred while starting login", { meta: { error } });
        return httpError(next, req, error as Error, responseMessage.SOME_ERROR_OCCURRED);
    }
};

export const verifyLoginOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { challengeId, otp } = req.body as { challengeId?: unknown; otp?: unknown };
        if (typeof challengeId !== "string" || !/^[\da-f-]{36}$/i.test(challengeId) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
            return httpError(next, req, new Error("A valid challengeId and six digit OTP are required"), responseMessage.BAD_REQUEST);
        }
        const redis = redisService.getClient();
        if (!redis?.isOpen) throw new Error("Redis is unavailable for login verification");
        const key = `auth:login-otp:${challengeId}`;
        const cachedValue = await redis.get(key);
        if (!cachedValue) return httpError(next, req, new Error("OTP is invalid or expired"), responseMessage.UNAUTHORIZED);
        const record = JSON.parse(cachedValue) as { userId: string; digest: string; attempts: number };
        if (record.attempts >= 5) {
            await redis.del(key);
            return httpError(next, req, new Error("OTP is invalid or expired"), responseMessage.UNAUTHORIZED);
        }
        const expected = Buffer.from(record.digest, "hex");
        const provided = otpDigest(challengeId, otp);
        if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
            record.attempts += 1;
            await redis.set(key, JSON.stringify(record), { KEEPTTL: true });
            return httpError(next, req, new Error("OTP is invalid or expired"), responseMessage.UNAUTHORIZED);
        }
        await redis.del(key);
        const user = await Users.findById(record.userId);
        if (!user) return httpError(next, req, new Error("User no longer exists"), responseMessage.UNAUTHORIZED);
        return completeLogin(req, res, next, user);
    } catch (error) {
        logger.error("Exception occurred while verifying login OTP", { meta: { error } });
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
