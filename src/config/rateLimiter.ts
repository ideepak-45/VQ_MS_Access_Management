import { RateLimiterMongo } from "rate-limiter-flexible";
import { Connection } from "mongoose";
import { logger } from "../util/logger";

export let rateLimiterMongo: null | RateLimiterMongo = null;

const POINTS = 100; // Number of points
const DURATION = 60; // Per second(s)
const BLOCK_DURATION = 60; // Block for 1 minute if consumed more than points

export const initRateLimiter = async (connection: Connection): Promise<void> => {
    try {
        rateLimiterMongo = new RateLimiterMongo({
            storeClient: connection,
            points: POINTS,
            duration: DURATION,
            blockDuration: BLOCK_DURATION,
        });
    } catch (error) {
        logger.error("Failed to initialize rate limiter:", { meta: { error } });
        throw error;
    }
};
