import dotenvFlow from "dotenv-flow";

dotenvFlow.config();

export const config = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || "development",
    SERVER_URL: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`,
    MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/",
    CORS_ORIGIN: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:3000"],
    DATA_ENC_KEY: process.env.DATA_ENC_KEY,
    SEARCH_KEY: process.env.SEARCH_KEY,
    AUTH_SECRET_KEY: process.env.AUTH_SECRET_KEY,
    SESSION_EXPIRATION: process.env.SESSION_EXPIRATION,
    JWT_ACCESS_KEY: process.env.JWT_ACCESS_KEY,
    JWT_REFRESH_KEY: process.env.JWT_REFRESH_KEY,
    REFRESH_TOKEN_EXPIRATION: process.env.REFRESH_TOKEN_EXPIRATION,
    ACCESS_TOKEN_EXPIRATION: process.env.ACCESS_TOKEN_EXPIRATION,
    MAX_DEVICE_SESSIONS: process.env.MAX_DEVICE_SESSIONS,
};
