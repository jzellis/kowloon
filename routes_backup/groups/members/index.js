import express from "express";
import collection from "./collection.js";
import id from "./id.js";

const router = express.Router({ mergeParams: true });
router.get("/", collection);
router.get("/:memberId", id);
export default router;
