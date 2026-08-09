import { Schema, Document, Query, Aggregate } from "mongoose";
import { encrypt, decrypt } from "../util/crypto";
import { logger } from "../util/logger";

// ======================================================
// DECLARATION MERGING: ADD "isEncrypted" TO OPTIONS
// ======================================================
declare module "mongoose" {
    interface SchemaTypeOptions<T> {
        isEncrypted?: boolean; // Renamed to prevent CSFLE conflict
        _typeConstraint?: T; // Uses 'T' to satisfy strict TS/ESLint rules
    }
}

// ======================================================
// PLUGIN IMPLEMENTATION
// ======================================================
export function encryptionPlugin<T extends Document>(schema: Schema<T>): void {
    const encryptedFields: string[] = [];

    /* ======================================================
     GET ENCRYPTED FIELDS
  ====================================================== */
    schema.eachPath((pathname, schemaType) => {
        // Safely cast the options to check for our custom property
        const options = schemaType.options as { isEncrypted?: boolean };
        if (options.isEncrypted === true) {
            encryptedFields.push(pathname);
        }
    });

    if (encryptedFields.length === 0) return;

    /* ======================================================
     ENCRYPT/DECRYPT HELPERS
  ====================================================== */
    function decryptFields(data: unknown): void {
        if (!data || typeof data !== "object") return;

        const doc = data as Record<string, unknown>;

        for (const field of encryptedFields) {
            if (doc[field] !== undefined && doc[field] !== null) {
                try {
                    doc[field] = decrypt(String(doc[field]));
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error(`Failed to decrypt field "${field}":`, errorMessage);
                }
            }
        }
    }

    function processPostHookResult(result: unknown): void {
        if (Array.isArray(result)) {
            result.forEach(decryptFields);
        } else {
            decryptFields(result);
        }
    }

    /* ======================================================
     PRE SAVE (DOCUMENT ENCRYPTION)
  ====================================================== */
    schema.pre("save", function (this: Document) {
        for (const field of encryptedFields) {
            if (this.isModified(field)) {
                const val = this.get(field);
                if (val !== undefined && val !== null) {
                    this.set(field, encrypt(String(val)));
                }
            }
        }
    });

    /* ======================================================
     QUERY ENCRYPTION HELPERS
  ====================================================== */
    function encryptQuery(this: Query<unknown, T>): void {
        const query = this.getQuery() as Record<string, unknown>;

        for (const field of encryptedFields) {
            if (query[field] !== undefined && query[field] !== null) {
                query[field] = encrypt(String(query[field]));
            }
        }
    }

    function encryptUpdate(this: Query<unknown, T>): void {
        const update = this.getUpdate() as Record<string, unknown> | null;
        if (!update) return;

        const operators = ["$set", "$setOnInsert"] as const;

        for (const operator of operators) {
            if (update[operator] && typeof update[operator] === "object") {
                const opObj = update[operator] as Record<string, unknown>;

                for (const field of encryptedFields) {
                    if (opObj[field] !== undefined && opObj[field] !== null) {
                        opObj[field] = encrypt(String(opObj[field]));
                    }
                }
            }
        }

        for (const field of encryptedFields) {
            if (update[field] !== undefined && update[field] !== null) {
                update[field] = encrypt(String(update[field]));
            }
        }
    }

    /* ======================================================
     PRE QUERY MIDDLEWARES
  ====================================================== */
    const queryMethods = /^(find|findOne|findOneAndDelete|findOneAndRemove|deleteOne|deleteMany|countDocuments)$/;
    schema.pre(queryMethods, function (this: Query<unknown, T>) {
        encryptQuery.call(this);
    });

    /* ======================================================
     PRE UPDATE MIDDLEWARES
  ====================================================== */
    const updateMethods = /^(findOneAndUpdate|updateOne|updateMany)$/;
    schema.pre(updateMethods, function (this: Query<unknown, T>) {
        encryptQuery.call(this);
        encryptUpdate.call(this);
    });

    /* ======================================================
     PRE AGGREGATE MIDDLEWARE
  ====================================================== */
    schema.pre("aggregate", function (this: Aggregate<unknown>) {
        const pipeline = this.pipeline();

        for (const stage of pipeline) {
            if ("$match" in stage && typeof stage.$match === "object" && stage.$match) {
                const matchObj = stage.$match as Record<string, unknown>;

                for (const field of encryptedFields) {
                    if (matchObj[field] !== undefined && matchObj[field] !== null) {
                        matchObj[field] = encrypt(String(matchObj[field]));
                    }
                }
            }
        }
    });

    /* ======================================================
     POST MIDDLEWARES (DECRYPTION)
  ====================================================== */
    schema.post("save", function (doc: Document) {
        decryptFields(doc);
    });

    const postReadMethods = /^(find|findOne|findOneAndUpdate)$/;
    schema.post(postReadMethods, function (res: unknown, next: (err?: Error) => void) {
        processPostHookResult(res);
        next();
    });

    schema.post("aggregate", function (res: unknown[], next: (err?: Error) => void) {
        processPostHookResult(res);
        next();
    });
}
