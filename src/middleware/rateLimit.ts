import { Request, Response, NextFunction } from "express";
import { logger } from "../util/logger";
import { rateLimiterMongo } from "../config/rateLimiter";
import { EApplicationEnvironment } from "../constant/application";
import { config } from "../config/config";
import httpError from "../util/httpError";
import responseMessage from "../constant/responseMessage";

export default (req: Request, _: Response, next: NextFunction): void => {
    if (config.NODE_ENV === EApplicationEnvironment.DEVELOPMENT) {
        return next();
    }

    if (!rateLimiterMongo) {
        logger.warn("Rate limiter not initialized");
        return next();
    }

    rateLimiterMongo
        .consume(req.ip as string, 1)
        .then(() => {
            next();
        })
        .catch((error) => {
            logger.error("Rate limit exceeded", { meta: { ip: req.ip, error } });
            httpError(next, req, new Error(responseMessage.RATE_LIMIT_EXCEEDED.message), responseMessage.RATE_LIMIT_EXCEEDED);
        });
};
