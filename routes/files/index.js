// /routes/files/index.js
// File upload and retrieval routes

import express from 'express';
import multer from 'multer';
import upload from './upload.js';
import list from './list.js';
import get from './get.js';
import serve from './serve.js';
import deleteFile from './delete.js';
import getSettings from '#methods/settings/get.js';

const router = express.Router({ mergeParams: true });

// Resolve upload size limit from settings (falls back to env, then 50 MB)
async function getMaxUploadBytes() {
  try {
    const settings = await getSettings();
    const mb = Number(settings?.maxUploadSize);
    if (mb > 0) return mb * 1024 * 1024;
  } catch {
    // settings unavailable during cold start — fall through
  }
  return parseInt(process.env.MAX_UPLOAD_SIZE || '50', 10) * 1024 * 1024;
}

// Dynamic multer middleware: re-checks limit per request so admin changes take effect.
// On LIMIT_FILE_SIZE we attach the error to req so the route handler can return a
// clean 413 instead of crashing with an unhandled MulterError.
function dynamicUpload(req, res, next) {
  getMaxUploadBytes().then((limit) => {
    const mw = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: limit },
    }).single('file');
    mw(req, res, (err) => {
      if (err && err.code === 'LIMIT_FILE_SIZE') {
        req.multerError = err;
        return next();
      }
      next(err);
    });
  }).catch(next);
}

// GET  /files         — list authenticated user's files
router.get('/', list);

// POST /files         — upload a file
router.post('/', dynamicUpload, upload);

// POST /files/upload  — upload alias
router.post('/upload', dynamicUpload, upload);

// GET  /files/download/* — serve file content (local storage)
router.get('/download/*', serve);

// GET  /files/:key    — get file metadata
router.get('/:key', get);

// DELETE /files/:key  — delete a file
router.delete('/:key', deleteFile);

export default router;
