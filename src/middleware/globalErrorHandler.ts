import { NextFunction, Request, Response } from "express";
import { THttpError } from "../types/types";

export default (error: THttpError, _: Request, res: Response, _next: NextFunction) => {
    res.status(error.statusCode).json(error);
};
