// /routes/files/get.js
// GET /files/:id/meta - Retrieve file metadata

import route from '../utils/route.js';
import File from '#schema/File.js';
import { buildFileUrl } from '#methods/files/signedUrl.js';
import { getSetting } from '#methods/settings/cache.js';

export default route(async ({ req, params, query, setStatus, set }) => {
  const { id } = params;

  if (!id) {
    setStatus(400);
    set('error', 'File id is required');
    return;
  }

  try {
    const file = await File.findOne({ id, deletedAt: null });

    if (!file) {
      setStatus(404);
      set('error', 'File not found');
      return;
    }

    // If a ready-to-use URL is requested, return an app-served signed URL
    // (works for both public and restricted files for its TTL).
    if (query.signed === 'true' || query.signed === '1') {
      const expiresIn = parseInt(query.expiresIn || '3600', 10);
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const signedUrl = buildFileUrl({
        fileId: file.id,
        domain: getSetting('domain'),
        protocol,
        restricted: true,
        ttlSeconds: expiresIn,
      });

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
