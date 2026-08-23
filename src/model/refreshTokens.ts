import mongoose from "mongoose";

interface refreshTokenInterface {
    userId: string;
    refreshTokenHash: string;
    sessionId: string;
    expressSessionId?: string; // Optional field for express-session ID
    jwtid: string;
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
    replacedBy: string | null;
    ip: string;
    userAgent: string;
    createdAt: Date;
}

const refreshTokenSchema = new mongoose.Schema<refreshTokenInterface>({
    // Reference to the user
    userId: {
        type: String,
        ref: "User",
        index: true,
    },

    // Store SHA-256 hash of the token for secure verification
    refreshTokenHash: {
        type: String,
        required: true,
        unique: true,
    },

    // Unique session identifier for the user
    sessionId: {
        type: String,
        required: true,
        index: true,
    },

    // Optional field to store the express-session ID for correlation
    expressSessionId: {
        type: String,
        default: null,
    },

    // Unique identifier for the JWT, used to prevent token reuse
    jwtid: {
        type: String,
        required: true,
        index: true,
    },

    // Timestamp when the token expires
    expiresAt: {
        type: Date,
        required: true,
    },

    // Timestamp when the token was rotated
    usedAt: {
        type: Date,
        default: null,
        index: true,
    },

    // Timestamp when the token was revoked
    revokedAt: {
        type: Date,
        default: null,
        index: true,
    },

    // JTI of the new token if this one was rotated
    replacedBy: {
        type: String,
        default: null,
    },

    // Metadata for audit and device tracking
    ip: String,
    userAgent: String,

    // Timestamp when the token was created
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// TTL index to automatically delete expired tokens
refreshTokenSchema.index(
    {
        expiresAt: 1,
    },
    {
        expireAfterSeconds: 0,
    }
);

const myDB = mongoose.connection.useDb("authprofile");

export const refreshTokens = myDB.model<refreshTokenInterface, mongoose.Model<refreshTokenInterface>>(
    "Refreshtoken",
    refreshTokenSchema,
    "refreshtokens"
);
