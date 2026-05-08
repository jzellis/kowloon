// /routes/files/serve.js
// Authenticated file proxy. Resolves visibility from the file's parent object,
// then issues a short-lived presigned S3 redirect. The browser loads the file
// directly from S3 — no bytes stream through Node, and no auth token appears
// in any URL the client ever holds.
//
// GET /files/:id          — redirect to presigned S3 URL (60s TTL)
// GET /files/:id?size=200 — redirect to presigned thumbnail URL
//
// Auth: Bearer token in Authorization header OR ?token= query param (legacy).

import { jwtVerify, importSPKI } from 'jose';
import kowloonId from '#methods/parse/kowloonId.js';
import File from '#schema/File.js';
import { getStorageAdapter } from '#methods/files/index.js';
import { getViewerContext } from '#methods/visibility/context.js';
import getSettings from '#methods/settings/get.js';
import { Post, Reply, User, Group, Page, Bookmark, Circle } from '#schema';

const PARENT_MODELS = { Post, Reply, User, Group, Page, Bookmark, Circle };

async function getParentTo(parentId) {
  if (!parentId) return null;
  const parsed = kowloonId(parentId);
  if (!parsed?.type) return null;
  if (parsed.type === 'User') {
    const user = await User.findOne({ id: parentId, deletedAt: null }).select('to actorId').lean();
    return user?.to ?? null;
  }
  const Model = PARENT_MODELS[parsed.type];
  if (!Model) return null;
  const doc = await Model.findOne({ id: parentId, deletedAt: null }).select('to actorId').lean();
  return doc?.to ?? null;
}

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

function normalizeVisibility(to) {
  if (!to) return '@public';
  const v = String(to).trim().toLowerCase();
  if (v === 'public' || v === '@public') return '@public';
  return to;
}

async function canAccess(to, file, viewerId) {
  const visibility = normalizeVisibility(to);
  if (visibility === '@public') return true;
  if (!viewerId) return false;
  if (file.actorId === viewerId) return true;
  const ctx = await getViewerContext(viewerId);
  if (visibility.startsWith('@')) return ctx.viewerDomain === visibility.slice(1);
  if (visibility === viewerId) return true;
  return ctx.circleIds.has(visibility) || ctx.groupIds.has(visibility);
}

export default async function serve(req, res) {
  const fileId = req.params.id;
  const sizeParam = req.query.size ? String(req.query.size) : null;

  if (!fileId) return res.status(400).json({ error: 'File id is required' });

  try {
    const file = await File.findOne({ id: fileId, deletedAt: null }).lean();
    if (!file) return res.status(404).json({ error: 'File not found' });

    const parentTo = file.parentObject ? await getParentTo(file.parentObject) : null;
    const effectiveTo = parentTo ?? file.to ?? '@public';

    const token = extractToken(req);
    const viewerId = await resolveViewer(token);
    const allowed = await canAccess(effectiveTo, file, viewerId);

    if (!allowed) {
      return res.status(viewerId ? 403 : 401).json({
        error: viewerId ? 'Access denied' : 'Authentication required',
      });
    }

    let storageKey = file.storageKey;
    if (sizeParam) {
      // Prefer the requested thumbnail; gracefully fall back to the original
      // so older files without thumbnails still serve when callers request a
      // size variant.
      const thumbKey = file.thumbnails?.[sizeParam];
      if (thumbKey) storageKey = thumbKey;
    }
    if (!storageKey) return res.status(404).json({ error: 'File has no storage key' });

    const storage = await getStorageAdapter();

    const exists = await storage.exists(storageKey);
    if (!exists) return res.status(404).json({ error: 'File not found in storage' });

    // Presigned URL TTL is set longer than the redirect's cache window so the
    // cached redirect URL is still valid when the browser re-uses it.
    const signedUrl = await storage.getSignedUrl(storageKey, 600);

    // Cache the redirect for 5 minutes so the browser can re-use the same
    // presigned URL across page loads. `private` keeps shared caches out of it
    // since the redirect target embeds visibility logic.
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.redirect(302, signedUrl);
  } catch (err) {
    console.error('[files/serve] Error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Failed to serve file' });
  }
}
