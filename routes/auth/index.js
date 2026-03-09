// /routes/auth/index.js
import express from "express";
import loginRouter from "./login.js";
import { strictRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router({ mergeParams: true });

router.use(strictRateLimiter);

// loginRouter already has router.post("/login", …)
// so we *mount* it here -- effective path will be /auth/login
router.use("/", loginRouter);

export default router;
