import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { logger } from "../util/logger";
import httpResponse from "../util/httpResponse";
import httpError from "../util/httpError";
import responseMessage from "../constant/responseMessage";
import { userDocument } from "../model/users";

export const login = async function (req: Request, res: Response, next: NextFunction) {
    try {
        logger.info(`Request recieved in login function`, { meta: { "req.body": req.body } });

        passport.authenticate("local", (err: Error | null, user: userDocument | false, info: { message: string } | undefined) => {
            // 1. Handle server errors during authentication
            if (err) {
                return next(err);
            }

            // 2. Handle authentication failure (wrong email/password)
            if (!user) {
                logger.error(`Passport LocalStrategy Authentication failed`, { meta: { info } });
                return httpError(
                    next,
                    req,
                    new Error(`Authentication failed ${(info as { message: string }).message}`),
                    responseMessage.UNAUTHORIZED
                );
            }

            // 3. Log the user in (establishes the session)
            req.logIn(user, (loginErr: Error | null) => {
                if (loginErr) {
                    return next(loginErr);
                }

                // Convert Mongoose document to plain object to safely manipulate it
                const authenticatedUser = JSON.parse(JSON.stringify(user));

                // Ensure we never send the hashed password back to the client
                delete authenticatedUser.password;
                // You may also want to hide the hashes from the API response
                delete authenticatedUser.emailHash;
                delete authenticatedUser.usernameHash;

                return httpResponse(req, res, responseMessage.SUCCESS, authenticatedUser);
            });
        })(req, res, next);
    } catch (error) {
        logger.error(`Exception occurred in login function`, error);
        return httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
    }
};

export const logout = async function (req: Request, res: Response, next: NextFunction) {
    try {
        logger.info(`Request recieved in logout function`, { meta: { "req.cookies": req.cookies } });

        req.logout((err) => {
            if (err) {
                logger.error(`Some error occurred while logging out`, { meta: { err } });
                return next(err);
            }

            req.session.destroy((sessionError) => {
                if (sessionError) {
                    logger.error(`Some error occurred while destroying session`, { meta: { sessionError } });
                    return next(sessionError);
                }

                res.clearCookie("connect.sid");

                logger.info(`User logged out successfully`);
                return httpResponse(req, res, responseMessage.SUCCESS, null);
            });
        });
    } catch (error) {
        logger.error(`Exception occurred in logout function`, error);
        return httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
    }
};
