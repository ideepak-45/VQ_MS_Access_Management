import { NextFunction, Request, Response } from "express";
import responseMessage from "../constant/responseMessage";
import httpError from "../util/httpError";
import { logger } from "../util/logger";
import { login, logout } from "../service/authService";

export default {
    login: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await login(req, res, next);
        } catch (error) {
            logger.error(`API CONTROLLER ERROR`, { meta: { endpoint: "/user", method: "GET" }, error });
            httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
        }
    },
    logout: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await logout(req, res, next);
        } catch (error) {
            logger.error(`API CONTROLLER ERROR`, { meta: { endpoint: "/user", method: "GET" }, error });
            httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
        }
    },
};
