// /routes/files/upload.js
// Handle file uploads via multipart/form-data

import route from '../utils/route.js';
import { getStorageAdapter } from '#methods/files/index.js';
import File from '#schema/File.js';
import isServerAdmin from '#methods/auth/isServerAdmin.js';
import getSettings from '#methods/settings/get.js';

export default route(
  async ({ req, body, user, setStatus, set }) => {
    if (req.multerError) {
      setStatus(413);
      set('error', req.multerError.message || 'File too large');
      return;
    }

    if (!req.file) {
      setStatus(400);
      set('error', 'No file uploaded');
      return;
    }

    const { originalname: originalFileName, buffer, mimetype } = req.file;
    const { title, summary, generateThumbnail, thumbnailSizes } = body;

    // Visibility: default @public; caller may restrict to a circle/domain/userId
    const to = typeof body.to === 'string' && body.to.trim() ? body.to.trim() : '@public';

    // Admins may specify an explicit actorId; otherwise use auth user
    let actorId = user.id;
    if (body.actorId && body.actorId !== user.id) {
      const admin = await isServerAdmin(user.id);
      if (!admin) {
        setStatus(403);
        set('error', 'Only admins may upload on behalf of another actor');
        return;
      }
      actorId = body.actorId;
    }

    try {
      const storage = await getStorageAdapter();

      // Always store private — the app proxies and enforces visibility
      const result = await storage.upload(buffer, {
        originalFileName,
        actorId,
        title,
        summary,
        contentType: mimetype,
        generateThumbnail: generateThumbnail === 'true' || generateThumbnail === true,
        thumbnailSizes: thumbnailSizes ? JSON.parse(thumbnailSizes) : [200, 400],
        isPublic: false,
      });

      // Build the app-proxied URL — serves via /files/download/:key
      const settings = await getSettings();
      const domain = settings?.domain || process.env.DOMAIN || 'localhost';
      const appUrl = `https://${domain}/files/download/${result.key}`;

      // Build thumbnail app URLs too
      let thumbnails = null;
      if (result.thumbnails) {
        thumbnails = {};
        for (const [size, _] of Object.entries(result.thumbnails)) {
          const thumbKey = `thumbnails/${result.key.replace(/\.[^.]+$/, '')}_${size}.webp`;
          thumbnails[size] = `https://${domain}/files/download/${thumbKey}`;
        }
      }

      const file = await File.create({
        actorId,
        to,
        originalFileName,
        name: title || originalFileName,
        summary,
        type: getFileType(mimetype),
        mediaType: result.metadata.contentType,
        extension: originalFileName.split('.').pop()?.toLowerCase(),
        url: appUrl,
        size: result.metadata.size,
        width: result.metadata.width,
        height: result.metadata.height,
        storageKey: result.key,
        thumbnails,
      });

      setStatus(200);
      set('file', {
        id: file.id,
        url: appUrl,
        thumbnails,
        metadata: result.metadata,
      });
    } catch (error) {
      console.error('[files/upload] Error:', error);
      setStatus(500);
      set('error', error.message || 'Failed to upload file');
    }
  },
  { allowUnauth: false }
);

function getFileType(mimeType) {
  if (!mimeType) return 'Document';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.startsWith('audio/')) return 'Audio';
  return 'Document';
}
