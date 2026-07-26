import { NextFunction, Request } from "express";
import { THttpError, TErrorMeta } from "../types/types";
import errorObject from "./errorObject";

export default (nextFunc: NextFunction, req: Request, err: Error | unknown, errorMeta: TErrorMeta): void => {
    const errorResponse: THttpError = errorObject(err, req, errorMeta);
    return nextFunc(errorResponse);
};
