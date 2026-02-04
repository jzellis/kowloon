// /routes/files/index.js
// File upload and retrieval routes

import express from 'express';
import multer from 'multer';
import upload from './upload.js';
import get from './get.js';
import serve from './serve.js';
import deleteFile from './delete.js';

const router = express.Router({ mergeParams: true });

// Configure multer for memory storage
const storage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE || '50', 10) * 1024 * 1024, // Default 50MB
  },
});

// POST /files - Upload a file
router.post('/', uploadMiddleware.single('file'), upload);

// GET /files/:key - Get file metadata
router.get('/:key', get);

// GET /files/download/:key - Serve file content (for local storage)
router.get('/download/*', serve);

// DELETE /files/:key - Delete a file
router.delete('/:key', deleteFile);

export default router;
