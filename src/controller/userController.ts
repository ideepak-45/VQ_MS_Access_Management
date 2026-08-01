import { NextFunction, Request, Response } from "express";
import responseMessage from "../constant/responseMessage";
import httpError from "../util/httpError";
import { logger } from "../util/logger";
import { createUser, fetchUsers, fetchUsersByQuery } from "../service/userService";

export default {
    fetchUsers: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await fetchUsers(req, res, next);
        } catch (error) {
            logger.error(`API CONTROLLER ERROR`, { meta: { endpoint: "/user", method: "GET" }, error });
            httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
        }
    },
    fetchUsersByQuery: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await fetchUsersByQuery(req, res, next);
        } catch (error) {
            logger.error(`API CONTROLLER ERROR`, { meta: { endpoint: "/user", method: "GET" }, error });
            httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
        }
    },
    createUser: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await createUser(req, res, next);
        } catch (error) {
            logger.error(`API CONTROLLER ERROR`, { meta: { endpoint: "/user", method: "POST" }, error });
            httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
        }
    },
};
