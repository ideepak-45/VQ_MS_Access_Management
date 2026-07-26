import dotenvFlow from "dotenv-flow";

dotenvFlow.config();

export const config = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || "development",
    SERVER_URL: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`,
    MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/",
    CORS_ORIGIN: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:3000"],
};
