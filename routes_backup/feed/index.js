// /routes/feed/index.js
import express from "express";
import pull from "./pull.js";
import timeline from "./timeline.js";

const router = express.Router({ mergeParams: true });

// Mount feed routes
router.use("/pull", pull);
router.use("/timeline", timeline);

export default router;
