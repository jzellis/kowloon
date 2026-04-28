// /routes/inbox/index.js
import express from "express";
import post from "./post.js";
import { inboxRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router({ mergeParams: true });

router.post("/", inboxRateLimiter, post);

export default router;
