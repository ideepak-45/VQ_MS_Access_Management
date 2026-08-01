import { Router } from "express";
import userController from "../controller/userController";

const router = Router();

// Rate limiting middleware applied to all routes
import rateLimitMiddleware from "../middleware/rateLimit";
router.use(rateLimitMiddleware);

// HTTP Method: GET | route for fetching all users
router.route("/").get(userController.fetchUsers);

// HTTP Method: QUERY | route for fetching users by query
router.route("/").all((req, res, next) => {
    if (req.method == "QUERY") {
        userController.fetchUsersByQuery(req, res, next);
    } else {
        next();
    }
});

// HTTP Method: POST | route for creating an user
router.route("/").post(userController.createUser);

export default router;
