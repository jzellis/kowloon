// /routes/outbox/index.js
import express from "express";
import post from "./post.js";

const router = express.Router();

// Local activity creation endpoint
router.post("/", post);

export default router;
