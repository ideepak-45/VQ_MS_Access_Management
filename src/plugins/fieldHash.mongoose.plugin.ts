/* eslint-disable @typescript-eslint/no-explicit-any */

import { Schema, Document, Query, UpdateQuery } from "mongoose";
import { searchableHash, bcryptHash } from "../util/crypto";

declare module "mongoose" {
    interface SchemaTypeOptions<T> {
        searchableHash?: boolean;
        passwordHash?: boolean; // New option for passwords
        _typeConstraint?: T; // Uses 'T' to satisfy strict TS/ESLint rules
    }
}

export function customHashPlugin(schema: Schema): void {
    const searchableFields: string[] = [];
    const passwordFields: string[] = [];

    // 1. Scan schema for both hash types
    schema.eachPath((pathname, schemaType) => {
        if (schemaType.options) {
            // Setup for Searchable Hashes
            if (schemaType.options.searchableHash) {
                searchableFields.push(pathname);
                const hashPath = `${pathname}Hash`;

                if (!schema.path(hashPath)) {
                    schema.add({
                        [hashPath]: {
                            type: String,
                            index: true,
                            select: false,
                        },
                    });
                }
            }

            // Setup for Password Hashes
            if (schemaType.options.passwordHash) {
                passwordFields.push(pathname);
                // We do NOT create a secondary field here.
                // We will replace the original field's value with the hash.
            }
        }
    });

    // 2. Middleware for document creation and .save() operations
    schema.pre("save", async function (this: Document) {
        // Process searchable hashes
        for (const pathname of searchableFields) {
            if (this.isModified(pathname)) {
                const value = this.get(pathname);
                if (value !== undefined && value !== null) {
                    // Assuming searchableHash is sync. If async, add await.
                    this.set(`${pathname}Hash`, searchableHash(String(value)));
                } else {
                    this.set(`${pathname}Hash`, undefined);
                }
            }
        }

        // Process password hashes
        for (const pathname of passwordFields) {
            if (this.isModified(pathname)) {
                const value = this.get(pathname);
                if (value !== undefined && value !== null) {
                    // Passwords MUST be awaited if bcrypt is used
                    const hashed = await bcryptHash(String(value));
                    this.set(pathname, hashed); // Overwrite the plaintext
                }
            }
        }
    });

    // 3. Middleware for update operations
    schema.pre(/^(findOneAndUpdate|updateOne|updateMany)$/, async function (this: Query<any, any>) {
        const update = this.getUpdate() as UpdateQuery<any>;
        if (!update) return;

        const setTarget = update.$set || update;

        // Process searchable hashes
        for (const pathname of searchableFields) {
            if (setTarget[pathname] !== undefined) {
                const value = setTarget[pathname];
                if (value !== null) {
                    setTarget[`${pathname}Hash`] = searchableHash(String(value));
                } else {
                    setTarget[`${pathname}Hash`] = null;
                }
            }
        }

        // Process password hashes
        for (const pathname of passwordFields) {
            if (setTarget[pathname] !== undefined) {
                const value = setTarget[pathname];
                if (value !== null) {
                    // Overwrite the plaintext in the update payload
                    setTarget[pathname] = await bcryptHash(String(value));
                }
            }
        }
    });
}
