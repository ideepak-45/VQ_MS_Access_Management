import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import httpError from "../util/httpError";
import responseMessage from "../constant/responseMessage";
import { logger } from "../util/logger";
import { verifyAccessToken } from "../config/jwt";

export function authenticateSession(req: Request, _res: Response, next: NextFunction) {
    // Passport injects the isAuthenticated() method into the request object
    if (req.isAuthenticated && req.isAuthenticated()) {
        logger.info(`User session authentication success`, { meta: { user: req.user } });
        return next(); // User is logged in, proceed to the route
    }

    // User is not logged in or user session expired, block the request
    return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
}

export function authenticateAccessToken(req: Request, _res: Response, next: NextFunction) {
    const accessToken = req.headers["authorization"]?.split(" ")[1]; // Assuming Bearer token format
    logger.info(`Access token received`, { meta: { accessToken } });
    if (!accessToken) {
        logger.warn(`Access token missing in request headers`);
        return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
    }

    const payload = verifyAccessToken(accessToken);

    logger.info(`Access token verification result`, { meta: { payload } });

    if (payload) {
        if (payload.type !== "access") {
            logger.warn(`Invalid token type`, { meta: { tokenType: payload.type } });
            return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
        }

        if ((payload.exp as number) < Math.floor(Date.now() / 1000)) {
            logger.warn(`Access token expired`, { meta: { exp: payload.exp, currentTime: Math.floor(Date.now() / 1000) } });
            return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
        }

        if (req.user && (req.user as { _id: mongoose.Types.ObjectId })._id.toString() !== payload.sub) {
            logger.warn(`Access token userId does not match session userId`, {
                meta: { sessionUserId: (req.user as { _id: mongoose.Types.ObjectId })._id.toString(), accessTokenUserId: payload.sub },
            });
            return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
        }

        logger.info(`Access token validation success`, { meta: { payload } });
        return next(); // Access token is valid, proceed to the route
    }

    logger.warn(`Access token validation failed`, { meta: { accessToken } });
    // User is not logged in or user session expired, block the request
    return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
}

export function authenticateSessionAndAccessToken(req: Request, _res: Response, next: NextFunction) {
    // Passport injects the isAuthenticated() method into the request object
    if (req.isAuthenticated && req.isAuthenticated()) {
        logger.info(`User session authentication success`, { meta: { user: req.user } });
    } else {
        logger.warn(`User session authentication failed or session expired`);
        return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
    }

    const accessToken = req.headers["authorization"]?.split(" ")[1]; // Assuming Bearer token format
    logger.info(`Access token received`, { meta: { accessToken } });
    if (!accessToken) {
        logger.warn(`Access token missing in request headers`);
        return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
    }

    const payload = verifyAccessToken(accessToken);

    logger.info(`Access token verification result`, { meta: { payload } });

    if (payload) {
        if (payload.type !== "access") {
            logger.warn(`Invalid token type`, { meta: { tokenType: payload.type } });
            return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
        }

        if ((payload.exp as number) < Math.floor(Date.now() / 1000)) {
            logger.warn(`Access token expired`, { meta: { exp: payload.exp, currentTime: Math.floor(Date.now() / 1000) } });
            return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
        }

        if (req.user && (req.user as { _id: mongoose.Types.ObjectId })._id.toString() !== payload.sub) {
            logger.warn(`Access token userId does not match session userId`, {
                meta: { sessionUserId: (req.user as { _id: mongoose.Types.ObjectId })._id.toString(), accessTokenUserId: payload.sub },
            });
            return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
        }

        logger.info(`Access token validation success`, { meta: { payload } });
        return next(); // Access token is valid, proceed to the route
    }

    logger.warn(`Access token validation failed`, { meta: { accessToken } });
    // User is not logged in or user session expired, block the request
    return httpError(next, req, new Error(`User authentication failed or session expired`), responseMessage.UNAUTHORIZED);
}
