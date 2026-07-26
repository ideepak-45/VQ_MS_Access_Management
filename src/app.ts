import express, { Application, Request, Response, NextFunction } from "express";
import path from "path";
import router from "./router/apiRouter";
import globalErrorHandler from "./middleware/globalErrorHandler";
import httpError from "./util/httpError";
import httpResponse from "./util/httpResponse";
import responseMessage from "./constant/responseMessage";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config/config";

const app: Application = express();

// Middleware
app.use(helmet());
app.use(
    cors({
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
        origin: config.CORS_ORIGIN,
        credentials: true,
    })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "../", "public")));

// Routes
app.use("/api", router);

// Ignore specific paths from logging and error handling
const ignoredPaths = ["/favicon.ico", "/robots.txt", "/.well-known/appspecific/com.chrome.devtools.json"];

app.use((req: Request, res: Response, next: NextFunction) => {
    if (ignoredPaths.includes(req.originalUrl)) {
        httpResponse(req, res, responseMessage.NO_CONTENT);
    } else {
        next();
    }
});

// 404 Handler
app.use((req: Request, _: Response, next: NextFunction) => {
    try {
        throw new Error(responseMessage.NOT_FOUND("route").message);
    } catch (error) {
        httpError(next, req, error, responseMessage.NOT_FOUND("route"));
    }
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
