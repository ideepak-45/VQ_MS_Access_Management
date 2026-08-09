import crypto from "crypto";
import { config } from "../config/config";

const algorithm = "aes-256-gcm";
const DATA_ENC_KEY = config.DATA_ENC_KEY;

const secretKey = crypto
    .createHash("sha256")
    .update(DATA_ENC_KEY as string)
    .digest(); // 32 bytes key

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(12); // GCM recommended IV size

    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Store iv + authTag + encrypted data
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(encryptedText: string): string {
    const data = Buffer.from(encryptedText, "base64");

    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const encrypted = data.subarray(28);

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString("utf8");
}
