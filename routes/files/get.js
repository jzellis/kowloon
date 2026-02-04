// /routes/files/get.js
// GET /files/:key - Retrieve file metadata

import route from '../utils/route.js';
import File from '#schema/File.js';
import { getStorageAdapter } from '#methods/files/index.js';

export default route(async ({ params, query, setStatus, set }) => {
  const { key } = params;

  if (!key) {
    setStatus(400);
    set('error', 'File key is required');
    return;
  }

  try {
    // Try to find by storage key first, then by ID
    let file = await File.findOne({ storageKey: key });
    if (!file) {
      file = await File.findOne({ id: key });
    }
    if (!file) {
      // Try with file: prefix
      file = await File.findOne({ id: `file:${key}` });
    }

    if (!file) {
      setStatus(404);
      set('error', 'File not found');
      return;
    }

    // If signed URL requested
    if (query.signed === 'true' || query.signed === '1') {
      const expiresIn = parseInt(query.expiresIn || '3600', 10);
      const storage = await getStorageAdapter();
      const signedUrl = await storage.getSignedUrl(file.storageKey || key, expiresIn);

      setStatus(200);
      set('file', file.toObject());
      set('signedUrl', signedUrl);
      return;
    }

    setStatus(200);
    set('file', file.toObject());
  } catch (error) {
    console.error('[files/get] Error:', error);
    setStatus(500);
    set('error', error.message || 'Failed to retrieve file');
  }
});
