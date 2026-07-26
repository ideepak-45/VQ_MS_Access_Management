import { Request } from "express";
import { config } from "../config/config";
import { EApplicationEnvironment } from "../constant/application";
import responseMessage from "../constant/responseMessage";
import { THttpError, TErrorMeta } from "../types/types";
import { logger } from "./logger";

export default (err: Error | unknown, req: Request, errorMeta: TErrorMeta): THttpError => {
    const errorObject: THttpError = {
        success: false,
        code: errorMeta.code,
        statusCode: errorMeta.statusCode,
        retryable: errorMeta.retryable,
        request: {
            ip: req.ip || null,
            method: req.method,
            url: req.originalUrl,
        },
        message: err instanceof Error ? err.message : errorMeta.message || errorMeta.message,
        data: null,
        stacktrace: err instanceof Error ? { name: err.name, stack: err.stack } : null,
    };

    // log
    logger.error(`HTTP ERROR`, { meta: { endpoint: req.originalUrl, error: errorObject } });

    // production Environment: remove ip from response
    if (config.NODE_ENV === EApplicationEnvironment.PRODUCTION) {
        errorObject.message =
            errorObject.statusCode >= 500 && err instanceof Error ? responseMessage.INTERNAL_SERVER_ERROR.message : errorObject.message;
        delete errorObject.request.ip;
        delete errorObject.stacktrace;
    }

    return errorObject;
};
