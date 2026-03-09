// /routes/files/serve.js
// Authenticated file proxy. Streams from storage only if the viewer has access.
//
// Auth: Bearer token in Authorization header OR ?token= query param (for <img src>).
// Visibility: File.to uses same addressing as Post.to — @public, @domain, circleId, userId.

import { jwtVerify, importSPKI } from 'jose';
import File from '#schema/File.js';
import { getStorageAdapter } from '#methods/files/index.js';
import { getViewerContext } from '#methods/visibility/context.js';
import getSettings from '#methods/settings/get.js';

// ── token extraction ──────────────────────────────────────────────────────────

function extractToken(req) {
  const auth = req.headers?.authorization || '';
  const m = auth.match(/^(?:Bearer|Token|JWT)\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  if (auth && !/\s/.test(auth)) return auth.trim();
  return req.query?.token || '';
}

async function resolveViewer(token) {
  if (!token) return null;
  try {
    const settings = await getSettings();
    const pub = (settings?.publicKey || '').replace(/\\n/g, '\n').trim();
    if (!pub) return null;
    const domain = settings?.domain || process.env.DOMAIN;
    const issuer = domain ? `https://${domain}` : undefined;
    const key = await importSPKI(pub, 'RS256');
    const { payload } = await jwtVerify(token, key, issuer ? { issuer } : {});
    return payload?.user?.id || null;
  } catch {
    return null;
  }
}

// ── visibility check ──────────────────────────────────────────────────────────

async function canAccess(file, viewerId) {
  const to = file.to || '@public';

  // Public — anyone
  if (to === '@public') return true;

  // Must be authenticated from here
  if (!viewerId) return false;

  // Owner always has access
  if (file.actorId === viewerId) return true;

  const ctx = await getViewerContext(viewerId);

  // Server-scoped
  if (to.startsWith('@')) {
    const domain = to.slice(1);
    return ctx.viewerDomain === domain;
  }

  // Circle or Group membership
  if (ctx.circleIds.has(to) || ctx.groupIds.has(to)) return true;

  // Direct user-to-user (private)
  if (to === viewerId) return true;

  return false;
}

// ── handler ───────────────────────────────────────────────────────────────────

export default async function serve(req, res) {
  // key may contain subdirectory (e.g. thumbnails/abc_200.webp)
  const key = req.params[0];

  if (!key) {
    return res.status(400).json({ error: 'File key is required' });
  }

  try {
    // Find by storageKey — thumbnail keys won't have a File record, look up parent
    let file = await File.findOne({ storageKey: key, deletedAt: null }).lean();

    // Thumbnail: strip the thumbnail path and find the parent file
    if (!file && key.startsWith('thumbnails/')) {
      // thumbnails/1234-abcd_200.webp → 1234-abcd.png (or similar)
      const base = key.replace(/^thumbnails\//, '').replace(/_\d+\.webp$/, '');
      file = await File.findOne({
        storageKey: { $regex: `^${base}` },
        deletedAt: null,
      }).lean();
    }

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Resolve viewer from JWT (header or query param)
    const token = extractToken(req);
    const viewerId = await resolveViewer(token);

    // Check visibility
    const allowed = await canAccess(file, viewerId);
    if (!allowed) {
      return res.status(viewerId ? 403 : 401).json({
        error: viewerId ? 'Access denied' : 'Authentication required',
      });
    }

    // Stream from storage
    const storage = await getStorageAdapter();

    const exists = await storage.exists(key);
    if (!exists) {
      return res.status(404).json({ error: 'File not found in storage' });
    }

    const metadata = await storage.getMetadata(key);

    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    if (metadata.size) res.setHeader('Content-Length', metadata.size);

    // Cache: public files get long-lived cache; restricted files must revalidate
    if ((file.to || '@public') === '@public') {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'private, no-store');
    }

    const stream = await storage.getStream(key);
    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('[files/serve] stream error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
    });
  } catch (err) {
    console.error('[files/serve] Error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Failed to serve file' });
  }
}
