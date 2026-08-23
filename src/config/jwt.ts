import jwt, { JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import parse from "parse-duration";
import { Request } from "express";
import { config } from "../config/config";
import { generateUniqueId, searchableHash } from "../util/crypto";
import { refreshTokens } from "../model/refreshTokens";
import { logger } from "../util/logger";

if (!config.JWT_ACCESS_KEY) {
    throw new Error("JWT_ACCESS_KEY must be set in environment");
}

if (!config.JWT_REFRESH_KEY) {
    throw new Error("JWT_REFRESH_KEY must be set in environment");
}

if (!config.REFRESH_TOKEN_EXPIRATION) {
    throw new Error("REFRESH_TOKEN_EXPIRATION must be set in environment");
}

if (!config.ACCESS_TOKEN_EXPIRATION) {
    throw new Error("ACCESS_TOKEN_EXPIRATION must be set in environment");
}

const JWT_ACCESS_KEY = config.JWT_ACCESS_KEY as string;
const JWT_REFRESH_KEY = config.JWT_REFRESH_KEY as string;
const REFRESH_TOKEN_EXPIRATION = config.REFRESH_TOKEN_EXPIRATION as string;
const ACCESS_TOKEN_EXPIRATION = config.ACCESS_TOKEN_EXPIRATION as string;

export type AccessTokenPayload = JwtPayload & { sub?: string | number; username?: string };
export type RefreshTokenPayload = JwtPayload & { sub?: string | number };

export function hashRefreshToken(token: string): string {
    return searchableHash(token);
}

export function getClientIp(req: Request): string {
    const headers = req.headers as (Headers & {
        get?: (key: string) => string | null;
    }) &
        Record<string, string | string[] | undefined>;

    const forwarded =
        headers.get?.("x-forwarded-for") ?? headers.get?.("X-Forwarded-For") ?? headers["x-forwarded-for"] ?? headers["X-Forwarded-For"];

    if (typeof forwarded === "string") {
        return forwarded.split(",")[0]?.trim() || "";
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
        const firstForwarded = forwarded[0] ?? "";
        return firstForwarded.split(",")[0]?.trim() || "";
    }

    const remoteAddress = (req as Request & { socket?: { remoteAddress?: string | null } }).socket?.remoteAddress ?? "";
    return remoteAddress;
}

export function getUserAgent(req: Request): string {
    const headers = req.headers as (Headers & {
        get?: (key: string) => string | null;
    }) &
        Record<string, string | string[] | undefined>;

    const userAgent = headers.get?.("user-agent") ?? headers.get?.("User-Agent") ?? headers["user-agent"] ?? headers["User-Agent"] ?? "";

    return Array.isArray(userAgent) ? (userAgent[0] ?? "") : userAgent;
}

interface CreateRefreshTokenParams {
    userId: string;
    sessionId: string;
    expressSessionId: string;
    ip: string;
    userAgent: string;
    mongooseSession: mongoose.ClientSession; // Add mongoose session parameter
}

export async function createRefreshToken({ userId, sessionId, expressSessionId, ip, userAgent, mongooseSession }: CreateRefreshTokenParams) {
    const jwtid = generateUniqueId();
    const refreshTokenExpiry = parse(REFRESH_TOKEN_EXPIRATION) ?? eval("7*24*60*60*1000"); // Convert to milliseconds (7 days default)

    const expiresAt = new Date(Date.now() + refreshTokenExpiry);

    const refreshToken = jwt.sign(
        {
            sub: userId,
            type: "refresh",
        },
        JWT_REFRESH_KEY,
        {
            jwtid,
            expiresIn: refreshTokenExpiry / 1000, // Convert milliseconds to seconds
        }
    );

    await refreshTokens.create(
        [
            {
                userId: userId.toString(),
                sessionId,
                expressSessionId,
                jwtid,
                refreshTokenHash: hashRefreshToken(refreshToken),
                expiresAt,
                usedAt: null,
                revokedAt: null,
                replacedBy: null,
                ip,
                userAgent,
                createdAt: new Date(),
            },
        ],
        { session: mongooseSession } // Use the provided mongoose session for atomicity
    );

    return {
        refreshToken,
        jwtid,
        sessionId,
        expiresAt,
    };
}

interface CreateAccessTokenParams {
    userId: string;
    username: string;
    sessionId: string;
}

export async function createAccessToken({ userId, username, sessionId }: CreateAccessTokenParams) {
    const jwtid = generateUniqueId();

    const accessTokenExpiry = parse(ACCESS_TOKEN_EXPIRATION) ?? eval("15*60*1000"); // Convert to milliseconds (15 minutes default)

    const expiresAt = new Date(Date.now() + accessTokenExpiry);

    const accessToken = jwt.sign(
        {
            sub: userId.toString(),
            username,
            sessionId,
            type: "access",
        },
        JWT_ACCESS_KEY,
        {
            jwtid,
            expiresIn: accessTokenExpiry / 1000, // Convert milliseconds to seconds
        }
    );

    return {
        accessToken,
        jwtid,
        expiresAt,
    };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    try {
        const decoded = jwt.verify(token, JWT_ACCESS_KEY);
        if (typeof decoded === "string") {
            // unexpected string payload
            return { sub: decoded } as AccessTokenPayload;
        }
        return decoded as AccessTokenPayload;
    } catch (err) {
        logger.warn(`Access token verification failed`, { meta: { error: err } });
        return null as unknown as AccessTokenPayload; // Return null if verification fails
    }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_KEY);
        if (typeof decoded === "string") {
            return { sub: decoded } as RefreshTokenPayload;
        }
        return decoded as RefreshTokenPayload;
    } catch (err) {
        logger.warn(`Refresh token verification failed`, { meta: { error: err } });
        return null as unknown as RefreshTokenPayload; // Return null if verification fails
    }
}
