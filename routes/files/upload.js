// /routes/files/upload.js
// Handle file uploads via multipart/form-data

import route from '../utils/route.js';
import { getStorageAdapter } from '#methods/files/index.js';
import File from '#schema/File.js';

export default route(
  async ({ req, body, user, setStatus, set }) => {
    if (!req.file) {
      setStatus(400);
      set('error', 'No file uploaded');
      return;
    }

    const { originalname: originalFileName, buffer, mimetype } = req.file;
    const { title, summary, generateThumbnail, thumbnailSizes, isPublic } = body;

    // Use authenticated user's ID, or allow explicit actorId for server-to-server
    const actorId = user?.id || body.actorId;

    if (!actorId) {
      setStatus(400);
      set('error', 'Authentication required for file upload');
      return;
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

      // Create File record in database
      const file = new File({
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
        // Store the storage key for later retrieval/deletion
        storageKey: result.key,
        thumbnails: result.thumbnails,
      });

      await file.save();

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

/**
 * Determine file type category from MIME type
 */
function getFileType(mimeType) {
  if (!mimeType) return 'Document';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.startsWith('audio/')) return 'Audio';
  return 'Document';
}
