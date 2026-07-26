import { Router } from "express";
import apiController from "../controller/apiController";

const router = Router();

// Rate limiting middleware applied to all routes
import rateLimitMiddleware from "../middleware/rateLimit";
router.use(rateLimitMiddleware);

router.route("/self").get(apiController.self);
router.route("/health").get(apiController.health);

export default router;
