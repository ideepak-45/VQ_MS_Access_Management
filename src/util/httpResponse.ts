import { Request, Response } from "express";
import { THttpResponse, TResponseMeta } from "../types/types";
import { config } from "../config/config";
import { EApplicationEnvironment } from "../constant/application";
import { logger } from "./logger";

export default (req: Request, res: Response, responseMeta: TResponseMeta, data: unknown = null): void => {
    const response: THttpResponse = {
        success: responseMeta.statusCode >= 200 && responseMeta.statusCode < 300,
        code: responseMeta.code,
        statusCode: responseMeta.statusCode,
        request: {
            ip: req.ip || null,
            method: req.method,
            url: req.originalUrl,
        },
        message: responseMeta.message,
        data: data,
    };

    // log
    logger.info(`HTTP RESPONSE`, { meta: { endpoint: req.originalUrl, response: JSON.stringify(response) } });

    // production Environment: remove ip from response
    if (config.NODE_ENV === EApplicationEnvironment.PRODUCTION) {
        delete response.request.ip;
    }

    res.status(responseMeta.statusCode).json(response);
};
