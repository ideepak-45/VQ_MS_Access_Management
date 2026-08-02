/* eslint-disable @typescript-eslint/no-explicit-any */

import { Schema, Document, Model, Query, Aggregate, PipelineStage, UpdateQuery, SchemaDefinition } from "mongoose";

/**
 * Configuration options for the Soft Delete plugin
 */
export interface SoftDeleteOptions {
    /**
     * If true, creates a database index on the `isDeleted` field for performance.
     * @default true
     */
    index?: boolean;
}

/**
 * Fields injected into the schema by the plugin
 */
export interface SoftDeleteFields {
    isDeleted: boolean;
    deletedAt: Date | null;
}

/**
 * Interface for the Document instance, ensuring instance methods are typed
 */
export interface SoftDeleteDocument extends Document, SoftDeleteFields {
    /** Soft deletes the document by setting isDeleted to true and populating deletedAt */
    softDelete(): Promise<this>;
    /** Restores the document by setting isDeleted to false and nullifying deletedAt */
    restore(): Promise<this>;
}

/**
 * Interface for the Model, extending the standard Mongoose Model with static helper methods
 */
export interface SoftDeleteModel<T extends SoftDeleteDocument> extends Model<T> {
    /** Finds exclusively soft-deleted documents */
    findDeleted(filter?: Record<string, unknown>): Query<T[], T>;
    /** Restores a single document matching the filter */
    restoreOne(filter: Record<string, unknown>): Promise<T | null>;
    /** Restores all documents matching the filter */
    restoreMany(filter: Record<string, unknown>): Promise<{ matchedCount: number; modifiedCount: number }>;
}

/**
 * Mongoose Soft Delete Plugin
 *
 * @param schema The Mongoose Schema
 * @param options Plugin options
 */
export function softDeletePlugin<T extends SoftDeleteDocument>(schema: Schema<T>, options?: SoftDeleteOptions): void {
    const createIndex = options?.index ?? true;

    // 1. Add fields to schema with explicit SchemaDefinition typing
    const pluginFields: SchemaDefinition<SoftDeleteFields> = {
        isDeleted: {
            type: Boolean,
            default: false,
            index: createIndex,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    };

    // Safely cast to the generic T's SchemaDefinition
    schema.add(pluginFields as any);

    // 2. Query Middleware to exclude soft-deleted docs
    // Mongoose natively supports RegExp to attach middleware to multiple methods.
    // This completely eliminates the need for loops or TypeScript casting.
    const queryMethodsRegex = /^(find|findOne|countDocuments|updateOne|updateMany|findOneAndUpdate)$/;

    schema.pre(queryMethodsRegex, function (this: Query<unknown, T>) {
        const queryOptions = this.getOptions();

        // Allow manual override via .setOptions({ includeDeleted: true })
        if (queryOptions && queryOptions["includeDeleted"] === true) {
            return;
        }

        this.where({ isDeleted: { $ne: true } });
    });

    // 3. Aggregate Middleware to exclude soft-deleted docs
    schema.pre("aggregate", function (this: Aggregate<unknown>) {
        const pipeline = this.pipeline();
        const aggregateOptions = this.options as Record<string, unknown> | undefined;

        // Allow manual override via aggregate.option({ includeDeleted: true })
        if (aggregateOptions && aggregateOptions["includeDeleted"] === true) {
            return;
        }

        // Insert a $match stage at the beginning of the pipeline
        const matchStage: PipelineStage = { $match: { isDeleted: { $ne: true } } };
        pipeline.unshift(matchStage);
    });

    // 4. Document Methods
    schema.methods["softDelete"] = async function (this: T): Promise<T> {
        this.isDeleted = true;
        this.deletedAt = new Date();
        return this.save();
    };

    schema.methods["restore"] = async function (this: T): Promise<T> {
        this.isDeleted = false;
        this.deletedAt = null;
        return this.save();
    };

    // 5. Model Static Methods
    schema.statics["findDeleted"] = function (this: Model<T>, filter: Record<string, unknown> = {}): Query<T[], T> {
        const deletedFilter = { ...filter, isDeleted: true };
        return this.find(deletedFilter).setOptions({ includeDeleted: true });
    };

    schema.statics["restoreOne"] = async function (this: Model<T>, filter: Record<string, unknown>): Promise<T | null> {
        const update: UpdateQuery<T> = {
            $set: {
                isDeleted: false,
                deletedAt: null,
            } as UpdateQuery<T>["$set"],
        };

        return this.findOneAndUpdate(filter, update, {
            new: true,
            includeDeleted: true,
        });
    };

    schema.statics["restoreMany"] = async function (
        this: Model<T>,
        filter: Record<string, unknown>
    ): Promise<{ matchedCount: number; modifiedCount: number }> {
        const update: UpdateQuery<T> = {
            $set: {
                isDeleted: false,
                deletedAt: null,
            } as UpdateQuery<T>["$set"],
        };

        const result = await this.updateMany(filter, update).setOptions({ includeDeleted: true }).exec();

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    };
}
