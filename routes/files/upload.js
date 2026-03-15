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
    const { title, summary, generateThumbnail, thumbnailSizes, parentObject } = body;

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

      // Always store private in the backend — visibility enforced by the proxy
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

      // Store thumbnail storage keys (not URLs) — proxy builds URLs at serve time
      let thumbnails = null;
      if (result.thumbnails) {
        thumbnails = {};
        for (const [size] of Object.entries(result.thumbnails)) {
          thumbnails[size] = `thumbnails/${result.key.replace(/\.[^.]+$/, '')}_${size}.webp`;
        }
      }

      // Create the File record first so we get the canonical file.id from the pre-save hook
      const settings = await getSettings();
      const domain = settings?.domain || process.env.DOMAIN || 'localhost';

      const file = new File({
        actorId,
        // If parentObject is provided, visibility is inherited from it at serve time.
        // to is left as the fallback for standalone files (defaults to @public).
        to: typeof body.to === 'string' && body.to.trim() ? body.to.trim() : '@public',
        parentObject: typeof parentObject === 'string' && parentObject.trim()
          ? parentObject.trim()
          : undefined,
        originalFileName,
        name: title || originalFileName,
        summary,
        type: getFileType(mimetype),
        mediaType: result.metadata.contentType,
        extension: originalFileName.split('.').pop()?.toLowerCase(),
        url: 'pending', // filled in below once we have the id
        size: result.metadata.size,
        width: result.metadata.width,
        height: result.metadata.height,
        storageKey: result.key,
        thumbnails,
      });

      await file.save(); // pre-save hook sets file.id = file:<_id>@domain

      // Now set the canonical app-proxied URL and save again
      file.url = `https://${domain}/files/${file.id}`;
      await file.save();

      // Build thumbnail response URLs (same pattern: /files/<id>?size=<n>)
      const thumbnailUrls = thumbnails
        ? Object.fromEntries(
            Object.keys(thumbnails).map((size) => [
              size,
              `https://${domain}/files/${file.id}?size=${size}`,
            ])
          )
        : null;

      setStatus(200);
      set('file', {
        id: file.id,
        url: file.url,
        thumbnails: thumbnailUrls,
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
