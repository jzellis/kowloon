// /routes/files/upload.js
// Handle file uploads via multipart/form-data

import route from '../utils/route.js';
import { getStorageAdapter } from '#methods/files/index.js';
import File from '#schema/File.js';
import isServerAdmin from '#methods/auth/isServerAdmin.js';

export default route(
  async ({ req, body, user, setStatus, set }) => {
    // multer LIMIT_FILE_SIZE error surfaces here as req.fileValidationError or
    // as a MulterError thrown before reaching this handler. Handle both.
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
    const { title, summary, generateThumbnail, thumbnailSizes, isPublic } = body;

    // Admins may specify an explicit actorId (e.g. server-to-server); otherwise use auth user
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

      const result = await storage.upload(buffer, {
        originalFileName,
        actorId,
        title,
        summary,
        contentType: mimetype,
        generateThumbnail: generateThumbnail === 'true' || generateThumbnail === true,
        thumbnailSizes: thumbnailSizes ? JSON.parse(thumbnailSizes) : [200, 400],
        isPublic: isPublic !== 'false' && isPublic !== false,
      });

      const file = await File.create({
        actorId,
        originalFileName,
        name: title || originalFileName,
        summary,
        type: getFileType(mimetype),
        mediaType: result.metadata.contentType,
        extension: originalFileName.split('.').pop()?.toLowerCase(),
        url: result.url,
        size: result.metadata.size,
        width: result.metadata.width,
        height: result.metadata.height,
        storageKey: result.key,
        thumbnails: result.thumbnails,
      });

      setStatus(200);
      set('file', {
        id: file.id,
        url: result.url,
        thumbnails: result.thumbnails,
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
