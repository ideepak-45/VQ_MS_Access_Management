import app from "./app";
import { config } from "./config/config";
import { logger } from "./util/logger";
import mongooseService from "./service/database/mongooseService";
import redisService from "./service/redis/redisService";
import { initRateLimiter } from "./config/rateLimiter";

const server = app.listen(config.PORT);

(async () => {
    try {
        const mongooseConnection = await mongooseService.connect();
        logger.info(`Connected to MongoDB`, {
            meta: { host: mongooseConnection.host, port: mongooseConnection.port, name: mongooseConnection.name },
        });

        await redisService.connect();

        logger.info("Connected to Redis", {
            meta: {
                host: config.REDIS_URI ? new URL(config.REDIS_URI).hostname : "localhost",
                port: config.REDIS_URI ? new URL(config.REDIS_URI).port || "6379" : "6379",
            },
        });

        await initRateLimiter(mongooseConnection);
        logger.info(`Rate limiter initialized`);

        logger.info(`APPLICATION STARTED`, { meta: { PORT: config.PORT, SERVER_URL: config.SERVER_URL } });
    } catch (error) {
        logger.error(`APPLICATION ERROR`, { meta: error });
        server.close((error) => {
            if (error) {
                logger.error(`APPLICATION CLOSING ERROR`, { meta: error });
            }

            process.exit(1);
        });
    }
})();

export default server;
