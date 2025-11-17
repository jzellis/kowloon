import express from "express";
import multer from "multer";
import upload from "./upload.js";
import get from "./get.js";

const router = express.Router({ mergeParams: true });

// Configure multer for memory storage
const storage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// POST /files - Upload a file
router.post("/", uploadMiddleware.single("file"), upload);

// GET /files/:id - Get file metadata
router.get("/:id", get);

export default router;
