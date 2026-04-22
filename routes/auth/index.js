// /routes/auth/index.js
import express from "express";
import loginRouter from "./login.js";
import forgotPasswordRouter from "./forgot-password.js";
import resetPasswordRouter from "./reset-password.js";
import verifyEmailRouter from "./verify-email.js";
import resendVerificationRouter from "./resend-verification.js";
import meRoute from "./me.js";
import { strictRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router({ mergeParams: true });

// /me is session-restore — must not be rate-limited
router.get("/me", meRoute);

// verify-email uses GET with a token in the query string — no rate limit needed here
// since tokens are single-use 32-byte random values
router.use("/", verifyEmailRouter);

router.use(strictRateLimiter);

router.use("/", loginRouter);
router.use("/", forgotPasswordRouter);
router.use("/", resetPasswordRouter);
router.use("/", resendVerificationRouter);

export default router;
