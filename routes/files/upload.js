// /routes/files/upload.js
// Handle file uploads via multipart/form-data

import route from '../utils/route.js';
import { getStorageAdapter } from '#methods/files/index.js';
import { validateUpload } from '#methods/files/validateUpload.js';
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

    const { originalname: originalFileName, mimetype } = req.file;
    let { buffer } = req.file;
    const { title, summary, thumbnailSizes, parentObject } = body;
    // Default to generating thumbnails; allow opting out by sending "false".
    // The S3Adapter will skip non-image MIME types regardless.
    const generateThumbnail = body.generateThumbnail === 'false' || body.generateThumbnail === false
      ? false
      : true;

    // Validate MIME type against allowlist, verify magic bytes, sanitize SVGs,
    // and re-encode raster images to strip embedded payloads.
    let mimeType;
    try {
      ({ buffer, mimeType } = await validateUpload(buffer, mimetype));
    } catch (err) {
      setStatus(415);
      set('error', err.message);
      return;
    }

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
        contentType: mimeType,
        generateThumbnail,
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
        type: getFileType(mimeType),
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

      // Build the canonical app-proxied URL. Honors X-Forwarded-Proto (Caddy /
      // nginx in front of the app) and the actual request Host so dev URLs land
      // at http://kwln.org:3000/... while prod URLs are https://kwln.org/...
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host  = req.headers['x-forwarded-host'] || req.headers.host || domain;
      const baseUrl = `${proto}://${host}`;
      file.url = `${baseUrl}/files/${file.id}`;
      await file.save();

      // Build thumbnail response URLs (same pattern: /files/<id>?size=<n>)
      const thumbnailUrls = thumbnails
        ? Object.fromEntries(
            Object.keys(thumbnails).map((size) => [
              size,
              `${baseUrl}/files/${file.id}?size=${size}`,
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
