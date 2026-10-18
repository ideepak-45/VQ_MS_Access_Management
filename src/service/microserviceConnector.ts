import http, { Agent as HttpAgent, IncomingHttpHeaders, RequestOptions as HttpRequestOptions } from "http";
import https, { Agent as HttpsAgent, RequestOptions as HttpsRequestOptions } from "https";
import { logger } from "../util/logger";

export interface MicroserviceEndpoint {
    /** DNS name or IP address; do not include a scheme or path. */
    host: string;
    /** Defaults to 443 for SSL and 80 otherwise. */
    port?: number;
    /** Selects HTTPS when true and HTTP when false. */
    ssl?: boolean;
    /** Defaults to '/'. */
    path?: string;
    /** Defaults to true. Keep certificate verification enabled in production. */
    rejectUnauthorized?: boolean;
    /** Optional TLS server name, useful when connecting to an IP for a named certificate. */
    servername?: string;
}

export interface MicroserviceRequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
    /** Maximum buffered response size. Defaults to 1 MiB. */
    maxResponseBytes?: number;
    /** Optional agent for connection pooling or custom transport configuration. */
    agent?: HttpAgent | HttpsAgent | false;
}

const defaultHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, timeout: 30_000 });
const defaultHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, timeout: 30_000 });

function normalizeEndpoint(endpoint: string | MicroserviceEndpoint): { endpoint: MicroserviceEndpoint; legacyUrl?: URL } {
    if (typeof endpoint !== "string") return { endpoint };
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`Unsupported microservice protocol: ${url.protocol}`);
    }
    return {
        endpoint: {
            host: url.hostname,
            ...(url.port ? { port: Number(url.port) } : {}),
            ssl: url.protocol === "https:",
            path: `${url.pathname}${url.search}`,
        },
        legacyUrl: url,
    };
}

function responseError(statusCode: number, statusMessage: string | undefined, headers: IncomingHttpHeaders, body: string): Error {
    const error = new Error(`Microservice returned HTTP ${statusCode}${statusMessage ? ` ${statusMessage}` : ""}`);
    Object.assign(error, { statusCode, responseHeaders: headers, responseBody: body.slice(0, 2048) });
    return error;
}

/** Sends JSON over Node's native HTTP or HTTPS transport with bounded timeout and response size. */
export function requestMicroservice<T>(target: string | MicroserviceEndpoint, options: MicroserviceRequestOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let normalized: ReturnType<typeof normalizeEndpoint>;
        try {
            normalized = normalizeEndpoint(target);
            if (!normalized.endpoint.host.trim()) throw new Error("Microservice host is required");
            if (
                normalized.endpoint.port !== undefined &&
                (!Number.isInteger(normalized.endpoint.port) || normalized.endpoint.port < 1 || normalized.endpoint.port > 65535)
            ) {
                throw new Error("Microservice port must be an integer between 1 and 65535");
            }
        } catch (error) {
            reject(error);
            return;
        }

        const { endpoint, legacyUrl } = normalized;
        const secure = endpoint.ssl ?? false;
        const payload = options.body === undefined ? undefined : Buffer.from(JSON.stringify(options.body));
        const headers: Record<string, string | number> = {
            accept: "application/json",
            ...(payload ? { "content-type": "application/json", "content-length": payload.byteLength } : {}),
            ...options.headers,
        };
        const requestConfig: HttpRequestOptions & HttpsRequestOptions = {
            protocol: secure ? "https:" : "http:",
            hostname: endpoint.host,
            port: endpoint.port ?? (secure ? 443 : 80),
            path: endpoint.path ?? "/",
            method: options.method ?? "POST",
            headers,
            agent: options.agent ?? (secure ? defaultHttpsAgent : defaultHttpAgent),
            ...(secure ? { rejectUnauthorized: endpoint.rejectUnauthorized ?? true } : {}),
            ...(endpoint.servername ? { servername: endpoint.servername } : {}),
            ...(legacyUrl?.username ? { auth: `${decodeURIComponent(legacyUrl.username)}:${decodeURIComponent(legacyUrl.password)}` } : {}),
        };
        const transport = secure ? https : http;
        const safeAddress = `${secure ? "https" : "http"}://${endpoint.host}:${requestConfig.port}${endpoint.path ?? "/"}`;

        const request = transport.request(requestConfig, (response) => {
            const chunks: Buffer[] = [];
            let receivedBytes = 0;
            const maxBytes = options.maxResponseBytes ?? 1024 * 1024;
            response.on("data", (chunk: Buffer | string) => {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                receivedBytes += buffer.length;
                if (receivedBytes > maxBytes) {
                    request.destroy(new Error(`Microservice response exceeded ${maxBytes} bytes`));
                    return;
                }
                chunks.push(buffer);
            });
            response.on("end", () => {
                const responseText = Buffer.concat(chunks).toString("utf8");
                const statusCode = response.statusCode ?? 0;
                if (statusCode < 200 || statusCode >= 300) {
                    reject(responseError(statusCode, response.statusMessage, response.headers, responseText));
                    return;
                }
                if (!responseText) {
                    resolve(undefined as T);
                    return;
                }
                try {
                    resolve(JSON.parse(responseText) as T);
                } catch (error) {
                    reject(new Error(`Microservice returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`));
                }
            });
            response.on("error", reject);
        });

        request.setTimeout(options.timeoutMs ?? 5000, () => request.destroy(new Error("Microservice request timed out")));
        request.on("error", (error) => {
            logger.error("Microservice request failed", { meta: { url: safeAddress, error } });
            reject(error);
        });
        if (payload) request.write(payload);
        request.end();
    });
}
