import { createClient, RedisClientType } from "redis";
import { config } from "../../config/config";
import { logger } from "../../util/logger";

let redisClient: RedisClientType | null = null;

export default {
    connect: async (): Promise<RedisClientType> => {
        try {
            const client = createClient({
                url: config.REDIS_URI,
            });

            client.on("error", (error) => {
                logger.error("Redis client error", { error });
            });

            await client.connect();

            redisClient = client;

            return client;
        } catch (error) {
            logger.error("Error connecting to Redis", { error });
            throw error;
        }
    },
    getClient: (): RedisClientType | null => {
        return redisClient;
    },
};
