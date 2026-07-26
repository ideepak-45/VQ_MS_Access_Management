import mongoose from "mongoose";
import { config } from "../../config/config";
import { logger } from "../../util/logger";

export default {
    connect: async (): Promise<mongoose.Connection> => {
        try {
            await mongoose.connect(config.MONGODB_URI);
            return mongoose.connection;
        } catch (error) {
            logger.error("Error connecting to MongoDB", { error });
            throw error;
        }
    },
};
