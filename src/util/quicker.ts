import os from "os";
import { Connection } from "mongoose";
import { config } from "../config/config";

const formatMB = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const formatGB = (bytes: number): string => `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;

const healthService = {
    getSystemHealth: () => {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        return {
            platform: os.platform(),
            architecture: os.arch(),
            hostname: os.hostname(),
            cpuCount: os.cpus().length,
            loadAverage: os.loadavg(), // Linux/macOS only; [0,0,0] on Windows
            totalMemory: formatGB(totalMemory),
            freeMemory: formatGB(freeMemory),
            usedMemory: formatGB(usedMemory),
            memoryUsagePercent: `${((usedMemory / totalMemory) * 100).toFixed(2)}%`,
            uptime: `${os.uptime()} seconds`,
        };
    },

    getApplicationHealth: () => {
        const memoryUsage = process.memoryUsage();

        return {
            environment: config.NODE_ENV,
            serverUrl: config.SERVER_URL,
            nodeVersion: process.version,
            pid: process.pid,
            uptime: `${process.uptime()} seconds`,
            memoryUsage: {
                rss: formatMB(memoryUsage.rss),
                heapTotal: formatMB(memoryUsage.heapTotal),
                heapUsed: formatMB(memoryUsage.heapUsed),
                external: formatMB(memoryUsage.external),
                arrayBuffers: formatMB(memoryUsage.arrayBuffers),
            },
        };
    },

    getMongoHealth: async (connection: Connection) => {
        try {
            const admin = connection.db?.admin?.();

            if (!admin || typeof admin.ping !== "function") {
                return {
                    status: "unhealthy",
                    readyState: connection.readyState,
                    error: "No database connection",
                };
            }

            await admin.ping();

            return {
                status: "healthy",
                readyState: connection.readyState,
                database: connection.name,
            };
        } catch (error: unknown) {
            return {
                status: "unhealthy",
                readyState: connection.readyState,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    },

    getHealth: async (connection: Connection) => {
        const mongoHealth = await healthService.getMongoHealth(connection);

        return {
            status: mongoHealth.status === "healthy" ? "healthy" : "unhealthy",
            timestamp: new Date().toISOString(),
            application: healthService.getApplicationHealth(),
            system: healthService.getSystemHealth(),
            dependencies: {
                mongodb: mongoHealth,
            },
        };
    },
};

export default healthService;
