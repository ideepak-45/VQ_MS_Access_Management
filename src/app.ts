import express, { Application, Request, Response, NextFunction } from "express";
import path from "path";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import parse from "parse-duration";
import passport from "./config/passport";
import router from "./router/apiRouter";
import userRouter from "./router/userRouter";
import authRouter from "./router/authRouter";
import globalErrorHandler from "./middleware/globalErrorHandler";
import httpError from "./util/httpError";
import httpResponse from "./util/httpResponse";
import responseMessage from "./constant/responseMessage";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config/config";
import { traceStorage } from "./util/logger";
import { authenticateSessionAndAccessToken } from "./middleware/authenticateUser";
import { EApplicationEnvironment } from "./constant/application";

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
app.use(cookieParser());

// Configure session
app.use(
    session({
        secret: config.AUTH_SECRET_KEY as string,
        resave: false,
        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: config.MONGODB_URI,
            dbName: "authprofile",
            collectionName: "sessions",
            touchAfter: 180, // 3 minutes
        }),

        rolling: true,

        cookie: {
            secure: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION, // true for HTTPS
            httpOnly: true,
            maxAge: parse(config.SESSION_EXPIRATION as string) ?? eval("15*60*1000"), // 15 minutes default
            sameSite: process.env.NODE_ENV === EApplicationEnvironment.PRODUCTION ? "none" : "lax",
        },
    })
);

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Inject traceId in logs
app.use((req: Request, res: Response, next: NextFunction) => {
    // Read an incoming cloud/gateway trace header, or create a fresh UUID
    const traceId = (req.headers["x-trace-id"] as string) || crypto.randomUUID();

    res.setHeader("x-trace-id", traceId);

    // Wrap execution inside the storage scope context
    traceStorage.run({ traceId }, () => {
        next();
    });
});

// Routes
app.use("/api", router);
app.use("/user", authenticateSessionAndAccessToken, userRouter);
app.use("/auth", authRouter);

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
