import express from "express";
import id from "./id.js";

const router = express.Router({ mergeParams: true });
router.get("/:id", id);
export default router;
