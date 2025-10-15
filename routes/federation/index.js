// /routes/federation/index.js
import express from "express";
import postPull from "./pull/post.js";
import authStart from "./auth/start.js";
import authFinish from "./auth/finish.js";

const router = express.Router({ mergeParams: true });

// Server-to-server scoped pull (batch per remote domain)
router.post("/pull", postPull);

// Optional remote-user auth challenge endpoints
router.post("/auth/start", authStart);
router.post("/auth/finish", authFinish);

export default router;
