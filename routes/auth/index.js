// /routes/auth/index.js
import express from "express";
import loginRouter from "./login.js";
import forgotPasswordRouter from "./forgot-password.js";
import resetPasswordRouter from "./reset-password.js";
import { strictRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router({ mergeParams: true });

router.use(strictRateLimiter);

router.use("/", loginRouter);
router.use("/", forgotPasswordRouter);
router.use("/", resetPasswordRouter);

export default router;
