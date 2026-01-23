// routes/resolve/index.js
// Object resolution endpoint for federation
import express from "express";
import get from "./get.js";

const router = express.Router();

// GET /resolve?id=<object-id>
router.get("/", get);

export default router;
