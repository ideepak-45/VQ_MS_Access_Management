import mongoose from "mongoose";
import bcrypt from "bcrypt";

interface userInterface {
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
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    mobile: {
        type: String,
        required: true,
        index: true,
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
    },
    password: {
        type: String,
        required: true,
    },
});

userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 12);
});

const myDB = mongoose.connection.useDb("authprofile");

export const Users = myDB.model("users", userSchema, "users");
