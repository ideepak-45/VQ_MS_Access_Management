import mongoose from "mongoose";

// Plugins
import { softDeletePlugin, SoftDeleteDocument, SoftDeleteModel } from "../plugins/softDelete.mongoose.plugin";
import { encryptionPlugin } from "../plugins/fieldEncryption.mongoose.plugin";
import { customHashPlugin } from "../plugins/fieldHash.mongoose.plugin";

interface userInterface extends SoftDeleteDocument {
    username: string;
    email: string;
    mobile: string;
    firstName: string;
    lastName: string;
    password: string;
}

interface userDocumentInterface extends userInterface, mongoose.Document {}

const userSchema: mongoose.Schema<userDocumentInterface> = new mongoose.Schema<userDocumentInterface>({
    username: {
        type: String,
        required: true,
        unique: true,
        isEncrypted: true,
        searchableHash: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        isEncrypted: true,
        searchableHash: true,
    },
    mobile: {
        type: String,
        required: true,
        index: true,
        isEncrypted: true,
    },
    firstName: {
        type: String,
        required: true,
        isEncrypted: true,
    },
    lastName: {
        type: String,
        isEncrypted: true,
    },
    password: {
        type: String,
        required: true,
        passwordHash: true,
    },
});

userSchema.plugin(softDeletePlugin, { index: true });
userSchema.plugin(customHashPlugin);
userSchema.plugin(encryptionPlugin);

const myDB = mongoose.connection.useDb("authprofile");

export const Users = myDB.model<userInterface, SoftDeleteModel<userInterface>>("users", userSchema, "users");
