import { Router } from "express";
import authController from "../controller/authController";

const router = Router();

// Rate limiting middleware applied to all routes
import rateLimitMiddleware from "../middleware/rateLimit";
router.use(rateLimitMiddleware);

// HTTP Method: POST | route for login
router.route("/login").post(authController.login);

// HTTP Method: GET | route for logout
router.route("/logout").get(authController.logout);

export default router;
