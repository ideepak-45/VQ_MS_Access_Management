import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../util/logger";
import { Users } from "../model/users";
import httpResponse from "../util/httpResponse";
import httpError from "../util/httpError";
import responseMessage from "../constant/responseMessage";

export const fetchUsers = async function (req: Request, res: Response, next: NextFunction) {
    try {
        logger.info(`Request recieved in fetchUsers function`);
        const usersData = await Users.find(
            {},
            {
                username: 1,
                email: 1,
                firstName: 1,
                lastName: 1,
                mobile: 1,
            }
        );
        httpResponse(req, res, responseMessage.SUCCESS, usersData);
    } catch (error) {
        logger.error(`Exception occurred in fetchUsers function`, error);
        httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
    }
};

export const fetchUsersByQuery = async function (req: Request, res: Response, next: NextFunction) {
    try {
        logger.info(`Request recieved in fetchUsersByQuery function`, { meta: { "req.body": req.body } });
        const { filters, sortings } = req.body;
        const usersData = await Users.find(filters, {
            username: 1,
            email: 1,
            firstName: 1,
            lastName: 1,
            mobile: 1,
        }).sort(sortings);
        httpResponse(req, res, responseMessage.SUCCESS, usersData);
    } catch (error) {
        logger.error(`Exception occurred in fetchUsers function`, error);
        httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
    }
};

export const createUser = async function (req: Request, res: Response, next: NextFunction) {
    try {
        logger.info(`Request recieved in createUser function`, { meta: { "req.body": req.body } });

        const { username, email, firstName, lastName, password, confirm_password, mobile } = req.body;

        const userAlreadyExists = await Users.findOne({
            $or: [{ username }, { email }],
        });

        if (userAlreadyExists) {
            httpError(next, req, new Error("username or email already taken"), responseMessage.CONFLICT);
        }

        if (password !== confirm_password) {
            httpError(next, req, new Error("password does not match with confirm_password"), responseMessage.BAD_REQUEST);
        }

        if (password == null || password.length < 8) {
            httpError(next, req, new Error("Password length must be greater than or equal to 8"), responseMessage.BAD_REQUEST);
        }

        if (mobile == null || mobile.length != 10) {
            httpError(next, req, new Error("Invalid mobile number"), responseMessage.BAD_REQUEST);
        }

        const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");

        const userObject = new Users({
            username,
            email,
            firstName,
            lastName,
            mobile,
            password: hashedPassword,
        });

        await userObject.save();

        httpResponse(req, res, responseMessage.CREATED, null);
    } catch (error) {
        logger.error(`Exception occurred in createUser function`, error);
        httpError(next, req, error, responseMessage.SOME_ERROR_OCCURRED);
    }
};
