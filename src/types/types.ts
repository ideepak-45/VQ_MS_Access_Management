export type THttpResponse = {
    success: boolean;
    code: string;
    statusCode: number;
    request: {
        ip?: string | null;
        method: string;
        url: string;
    };
    message: string;
    data: unknown;
};

export type THttpError = {
    success: boolean;
    code: string;
    statusCode: number;
    retryable: boolean;
    request: {
        ip?: string | null;
        method: string;
        url: string;
    };
    message: string;
    data: unknown;
    stacktrace?: object | null;
};

export type TResponseMeta = {
    code: string;
    statusCode: number;
    retryable: boolean;
    message: string;
};

export type TErrorMeta = {
    code: string;
    statusCode: number;
    retryable: boolean;
    message: string;
};
