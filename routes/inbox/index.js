// /routes/inbox/index.js
import express from "express";
import post from "./post.js";

const router = express.Router({ mergeParams: true });

// POST route for inbound federation (ActivityPub inbox)
router.post("/", post);

export default router;
