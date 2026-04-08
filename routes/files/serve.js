// /routes/files/serve.js
// Authenticated file proxy. Resolves visibility from the file's parent object.
//
// GET /files/:id          — serve original file
// GET /files/:id?size=200 — serve thumbnail at that size
//
// Auth: Bearer token in Authorization header OR ?token= query param (for <img src="...?token=...">).
//
// Visibility is inherited from the parent object (post, user, group, etc.).
// If no parentObject, falls back to file.to (defaults @public).

import { jwtVerify, importSPKI } from 'jose';
import kowloonId from '#methods/parse/kowloonId.js';
import File from '#schema/File.js';
import { getStorageAdapter } from '#methods/files/index.js';
import { getViewerContext } from '#methods/visibility/context.js';
import getSettings from '#methods/settings/get.js';
import { Post, Reply, User, Group, Page, Bookmark, Circle } from '#schema';

// ── parent model map ──────────────────────────────────────────────────────────

const PARENT_MODELS = { Post, Reply, User, Group, Page, Bookmark, Circle };

async function getParentTo(parentId) {
  if (!parentId) return null;
  const parsed = kowloonId(parentId);
  if (!parsed?.type) return null;

  // User visibility: use user.to (their own visibility setting)
  if (parsed.type === 'User') {
    const user = await User.findOne({ id: parentId, deletedAt: null })
      .select('to actorId')
      .lean();
    return user?.to ?? null;
  }

  const Model = PARENT_MODELS[parsed.type];
  if (!Model) return null;

  const doc = await Model.findOne({ id: parentId, deletedAt: null })
    .select('to actorId')
    .lean();
  return doc?.to ?? null;
}

// ── token / viewer resolution ─────────────────────────────────────────────────

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

function normalizeVisibility(to) {
  if (!to) return '@public';
  const v = String(to).trim().toLowerCase();
  if (v === 'public' || v === '@public') return '@public';
  return to; // circle ID, group ID, @domain, etc.
}

async function canAccess(to, file, viewerId) {
  const visibility = normalizeVisibility(to);

  if (visibility === '@public') return true;
  if (!viewerId) return false;
  if (file.actorId === viewerId) return true; // owner always has access

  const ctx = await getViewerContext(viewerId);

  // Server-scoped: @domain
  if (visibility.startsWith('@')) {
    return ctx.viewerDomain === visibility.slice(1);
  }

  // Direct user-to-user (private)
  if (visibility === viewerId) return true;

  // Circle or Group membership
  return ctx.circleIds.has(visibility) || ctx.groupIds.has(visibility);
}

// ── handler ───────────────────────────────────────────────────────────────────

export default async function serve(req, res) {
  const fileId = req.params.id;
  const sizeParam = req.query.size ? String(req.query.size) : null;

  if (!fileId) {
    return res.status(400).json({ error: 'File id is required' });
  }

  try {
    const file = await File.findOne({ id: fileId, deletedAt: null }).lean();
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Resolve effective visibility: inherit from parent if set, else own to
    const parentTo = file.parentObject
      ? await getParentTo(file.parentObject)
      : null;
    const effectiveTo = parentTo ?? file.to ?? '@public';

    // Auth
    const token = extractToken(req);
    const viewerId = await resolveViewer(token);

    const allowed = await canAccess(effectiveTo, file, viewerId);
    if (!allowed) {
      return res.status(viewerId ? 403 : 401).json({
        error: viewerId ? 'Access denied' : 'Authentication required',
      });
    }

    // Resolve which storage key to serve
    let storageKey = file.storageKey;

    if (sizeParam) {
      const thumbKey = file.thumbnails?.[sizeParam];
      if (!thumbKey) {
        return res.status(404).json({ error: `No thumbnail at size ${sizeParam}` });
      }
      storageKey = thumbKey;
    }

    if (!storageKey) {
      return res.status(404).json({ error: 'File has no storage key' });
    }

    const storage = await getStorageAdapter();
    const exists = await storage.exists(storageKey);
    if (!exists) {
      return res.status(404).json({ error: 'File not found in storage' });
    }

    const metadata = await storage.getMetadata(storageKey);
    const contentType = sizeParam
      ? 'image/webp'
      : (metadata.contentType || file.mediaType || 'application/octet-stream');

    res.setHeader('Content-Type', contentType);
    if (metadata.size) res.setHeader('Content-Length', metadata.size);

    // Public files: long-lived immutable cache. Restricted: no caching.
    if (effectiveTo === '@public') {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'private, no-store');
    }

    const stream = await storage.getStream(storageKey);
    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('[files/serve] stream error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
    });
  } catch (err) {
    console.error('[files/serve] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Failed to serve file' });
    }
  }
}
