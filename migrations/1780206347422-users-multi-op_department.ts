// Import your schemas here
import type { Connection } from "mongoose";

export async function up(connection: Connection): Promise<void> {
    // Write migration here
    const myDB = connection.useDb("authprofile"); // Replace with your database name
    const usersCollection = myDB.collection("users"); // Replace with your collection name

    // Example: Adding a new field 'department' to all documents in the 'users' collection
    await usersCollection.updateMany({ department: { $exists: false } }, { $set: { department: "General" } });
}

export async function down(connection: Connection): Promise<void> {
    // Write migration here
    const myDB = connection.useDb("authprofile"); // Replace with your database name
    const usersCollection = myDB.collection("users"); // Replace with your collection name

    // Example: Removing the 'department' field from all documents in the 'users' collection
    await usersCollection.updateMany({ department: { $exists: true } }, { $unset: { department: "" } });
}
