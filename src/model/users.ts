import mongoose from "mongoose";

const userSchema: mongoose.Schema = new mongoose.Schema({
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

const myDB = mongoose.connection.useDb("authprofile");

export const Users = myDB.model("users", userSchema, "users");
