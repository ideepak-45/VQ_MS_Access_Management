import { createLogger, format, transports } from "winston";
import { ConsoleTransportInstance, FileTransportInstance } from "winston/lib/winston/transports";
import util from "util";
import { config } from "../config/config";
import path from "path";
import { red, yellow, blue, green, magenta, cyanBright } from "colorette";
import * as sourceMapSupport from "source-map-support";
import "winston-mongodb";
import { MongoDBTransportInstance } from "winston-mongodb";
import { EApplicationEnvironment } from "../constant/application";
import { AsyncLocalStorage } from "async_hooks"; // 1. Import AsyncLocalStorage

// Enable source map support for better stack traces
sourceMapSupport.install();

// 2. Export a storage context instance to use in your Express middleware
export const traceStorage = new AsyncLocalStorage<{ traceId: string }>();

// 3. Create a custom Winston format to dynamically inject the traceId into the metadata
const injectTraceId = format((info) => {
    const store = traceStorage.getStore();
    if (store && store.traceId) {
        // Initialize meta block if missing
        if (!info.meta) info.meta = {};

        // Inject the traceId into the metadata block
        (info.meta as Record<string, unknown>).traceId = store.traceId;
    }
    return info;
});

const colorizeLevel = (level: string): string => {
    switch (level) {
        case "ERROR":
            return red(level);
        case "WARN":
            return yellow(level);
        case "INFO":
            return green(level);
        case "DEBUG":
            return blue(level);
        default:
            return level;
    }
};

const consoleLogFormat = format.printf((data) => {
    const { timestamp, level, message, meta = {} } = data;
    const metaString = util.inspect(meta, { depth: null, colors: true, showHidden: false });
    return `${cyanBright(timestamp as string)} [${colorizeLevel(level.toUpperCase())}]: ${message}\n${magenta("META")} ${metaString}\n`;
});

const consoleTransport = (): Array<ConsoleTransportInstance> => {
    if (
        config.NODE_ENV === EApplicationEnvironment.DEVELOPMENT ||
        config.NODE_ENV === EApplicationEnvironment.PRODUCTION ||
        config.NODE_ENV === EApplicationEnvironment.TESTING
    ) {
        return [
            new transports.Console({
                level: "info",
                format: format.combine(
                    injectTraceId(), // 4. Add the inject format before processing output
                    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                    consoleLogFormat
                ),
            }),
        ];
    }

    return [];
};

const fileLogFormat = format.printf((data) => {
    const { timestamp, level, message, meta = {} } = data;

    const logMeta: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
        if (value instanceof Error) {
            logMeta[key] = {
                name: value.name,
                message: value.message,
                stack: value.stack,
            };
        } else {
            logMeta[key] = value;
        }
    }

    const logData = {
        level: level.toUpperCase(),
        timestamp,
        message,
        meta: logMeta,
    };

    return JSON.stringify(logData, null, 4);
});

const fileTransport = (): Array<FileTransportInstance> => {
    if (config.NODE_ENV === EApplicationEnvironment.DEVELOPMENT) {
        return [
            new transports.File({
                filename: path.join(__dirname, `../../logs/${config.NODE_ENV}.log`),
                level: "info",
                format: format.combine(
                    injectTraceId(), // 4. Add the inject format before processing output
                    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                    fileLogFormat
                ),
            }),
        ];
    }

    return [];
};

const mongoDBTransport = (): Array<MongoDBTransportInstance> => {
    if (config.NODE_ENV === EApplicationEnvironment.DEVELOPMENT) {
        return [
            new transports.MongoDB({
                db: config.MONGODB_URI,
                collection: "logs",
                metaKey: "meta",
                options: { useNewUrlParser: true, useUnifiedTopology: true },
                level: "info",
                expireAfterSeconds: 60 * 60 * 24 * 7, // 7 days
                format: format.combine(
                    injectTraceId() // 4. Add the inject format before processing output | MongoDB accepts metadata object fields natively
                ),
            }),
        ];
    }

    return [];
};

export const logger = createLogger({
    defaultMeta: {
        meta: {},
    },
    transports: [...fileTransport(), ...consoleTransport(), ...mongoDBTransport()],
});
