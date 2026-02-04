// /routes/files/serve.js
// Serve file content (primarily for local storage adapter)

import { getStorageAdapter, detectAdapterType } from '#methods/files/index.js';
import LocalAdapter from '#methods/files/adapters/LocalAdapter.js';

export default async function serve(req, res) {
  // Extract key from path: /files/download/path/to/file.jpg -> path/to/file.jpg
  const key = req.params[0];

  if (!key) {
    return res.status(400).json({ error: 'File key is required' });
  }

  try {
    const storage = await getStorageAdapter();

    // Check for signed URL verification (for private files)
    const { expires, sig } = req.query;
    if (expires && sig) {
      // Verify signature for local adapter
      if (detectAdapterType() === 'Local') {
        const isValid = LocalAdapter.verifySignedUrl(key, expires, sig);
        if (!isValid) {
          return res.status(403).json({ error: 'Invalid or expired signature' });
        }
      }
    }

    // Check if file exists
    const exists = await storage.exists(key);
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get metadata for content-type
    const metadata = await storage.getMetadata(key);

    // Set response headers
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    if (metadata.size) {
      res.setHeader('Content-Length', metadata.size);
    }

    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Stream the file
    const stream = await storage.getStream(key);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('[files/serve] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to serve file' });
      }
    });
  } catch (error) {
    console.error('[files/serve] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to serve file' });
    }
  }
}
