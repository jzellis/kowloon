// /routes/federation/index.js
import express from "express";
import postPull from "./pull/post.js";
import clientPull from "./pull/client.js";
import authStart from "./auth/start.js";
import authFinish from "./auth/finish.js";

const router = express.Router({ mergeParams: true });

// Server endpoint: receives pull requests FROM remote servers
router.post("/pull", postPull);

// Client endpoint: makes pull requests TO remote servers
router.post("/pull/:domain", clientPull);

// Optional remote-user auth challenge endpoints
router.post("/auth/start", authStart);
router.post("/auth/finish", authFinish);

export default router;
