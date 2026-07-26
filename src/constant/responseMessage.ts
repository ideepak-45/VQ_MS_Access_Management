export default {
    SUCCESS: {
        code: "SUCCESS",
        statusCode: 200,
        retryable: false,
        message: "The request was successful.",
    },

    CREATED: {
        code: "CREATED",
        statusCode: 201,
        retryable: false,
        message: "The resource was created successfully.",
    },

    ACCEPTED: {
        code: "ACCEPTED",
        statusCode: 202,
        retryable: false,
        message: "The request has been accepted for processing.",
    },

    NO_CONTENT: {
        code: "NO_CONTENT",
        statusCode: 204,
        retryable: false,
        message: "The request was successful but there is no content to return.",
    },

    BAD_REQUEST: {
        code: "BAD_REQUEST",
        statusCode: 400,
        retryable: false,
        message: "The request is invalid.",
    },

    VALIDATION_ERROR: (field: string) => ({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        retryable: false,
        message: `Validation failed for '${field}'.`,
    }),

    INVALID_INPUT: {
        code: "INVALID_INPUT",
        statusCode: 400,
        retryable: false,
        message: "One or more input values are invalid.",
    },

    UNAUTHORIZED: {
        code: "UNAUTHORIZED",
        statusCode: 401,
        retryable: false,
        message: "Authentication is required.",
    },

    INVALID_CREDENTIALS: {
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
        retryable: false,
        message: "The provided credentials are invalid.",
    },

    TOKEN_EXPIRED: {
        code: "TOKEN_EXPIRED",
        statusCode: 401,
        retryable: false,
        message: "Authentication token has expired.",
    },

    TOKEN_INVALID: {
        code: "TOKEN_INVALID",
        statusCode: 401,
        retryable: false,
        message: "Authentication token is invalid.",
    },

    FORBIDDEN: {
        code: "FORBIDDEN",
        statusCode: 403,
        retryable: false,
        message: "You do not have permission to perform this action.",
    },

    NOT_FOUND: (entity: string) => ({
        code: "NOT_FOUND",
        statusCode: 404,
        retryable: false,
        message: `${entity} not found.`,
    }),

    RESOURCE_ALREADY_EXISTS: (entity: string) => ({
        code: "RESOURCE_ALREADY_EXISTS",
        statusCode: 409,
        retryable: false,
        message: `${entity} already exists.`,
    }),

    CONFLICT: {
        code: "CONFLICT",
        statusCode: 409,
        retryable: false,
        message: "The request conflicts with the current state of the resource.",
    },

    RATE_LIMIT_EXCEEDED: {
        code: "RATE_LIMIT_EXCEEDED",
        statusCode: 429,
        retryable: true,
        message: "Too many requests. Please try again later.",
    },

    DATABASE_ERROR: {
        code: "DATABASE_ERROR",
        statusCode: 500,
        retryable: true,
        message: "A database error occurred.",
    },

    DATABASE_TIMEOUT: {
        code: "DATABASE_TIMEOUT",
        statusCode: 503,
        retryable: true,
        message: "The database operation timed out.",
    },

    SERVICE_UNAVAILABLE: {
        code: "SERVICE_UNAVAILABLE",
        statusCode: 503,
        retryable: true,
        message: "The service is temporarily unavailable.",
    },

    EXTERNAL_SERVICE_ERROR: {
        code: "EXTERNAL_SERVICE_ERROR",
        statusCode: 502,
        retryable: true,
        message: "An external service failed to process the request.",
    },

    REQUEST_TIMEOUT: {
        code: "REQUEST_TIMEOUT",
        statusCode: 408,
        retryable: true,
        message: "The request timed out.",
    },

    INTERNAL_SERVER_ERROR: {
        code: "INTERNAL_SERVER_ERROR",
        statusCode: 500,
        retryable: false,
        message: "An unexpected server error occurred.",
    },

    SOME_ERROR_OCCURRED: {
        code: "UNKNOWN_ERROR",
        statusCode: 500,
        retryable: false,
        message: "An unexpected error occurred while processing the request.",
    },
} as const;
