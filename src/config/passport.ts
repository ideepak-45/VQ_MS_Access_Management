import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { userDocument, Users } from "../model/users"; // Adjust path as needed
import { searchableHash, bcryptCompare } from "../util/crypto";
import { logger } from "../util/logger";

// 1. Configure the Local Strategy
passport.use(
    new LocalStrategy(
        {
            usernameField: "usernameOrEmail",
            passwordField: "password",
        },
        async (usernameOrEmail: string, password: string, done) => {
            try {
                // Hash the email to search our indexed emailHash field
                const hashedUsernameOrEmail = searchableHash(usernameOrEmail);

                // Find user and explicitly include the hidden password field
                const user = await Users.findOne({ $or: [{ emailHash: hashedUsernameOrEmail }, { usernameHash: hashedUsernameOrEmail }] }).select(
                    "+password"
                );

                if (!user) {
                    logger.error(`Invalid username or email`);
                    return done(null, false, { message: "Invalid credentials" });
                }

                // Compare the provided password with the stored bcrypt hash
                const isMatch = await bcryptCompare(password, user.password);

                if (!isMatch) {
                    logger.error(`Invalid passowrd`);
                    return done(null, false, { message: "Invalid credentials" });
                }

                // Authentication successful
                return done(null, user);
            } catch (error) {
                logger.error(`Exception occurred in passport LocalStrategy`, { meta: { error } });
                return done(error);
            }
        }
    )
);

// 2. Serialize user to session (stores user.id in the session cookie)
passport.serializeUser((user, done) => {
    done(null, (user as userDocument).id);
});

// 3. Deserialize user from session (fetches user data on subsequent requests)
passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await Users.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

export default passport;
