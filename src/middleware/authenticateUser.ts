import { Request, Response, NextFunction } from "express";
import httpError from "../util/httpError";
import responseMessage from "../constant/responseMessage";
import { logger } from "../util/logger";

export function authenticateUser(req: Request, _res: Response, next: NextFunction) {
    // Passport injects the isAuthenticated() method into the request object
    if (req.isAuthenticated && req.isAuthenticated()) {
        logger.info(`User authentication success`, { meta: { user: req.user } });
        return next(); // User is logged in, proceed to the route
    }

    // User is not logged in or user session expired, block the request
    return httpError(next, req, new Error(`Authentication failed or session expired`), responseMessage.UNAUTHORIZED);
}
