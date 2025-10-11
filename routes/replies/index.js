import express from "express";
import collection from "./collection.js";
const router = express.Router({ mergeParams: true });
router.get("/", collection);
export default router;
