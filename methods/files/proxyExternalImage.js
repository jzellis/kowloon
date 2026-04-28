// proxyExternalImage — download an external image URL and store it as a File record.
// Used to cache og:image URLs from Link posts so they don't break if the source moves.
// Returns the new file: ID on success, undefined on failure (always non-fatal).

import dns from 'dns';
import net from 'net';
import { getStorageAdapter } from './StorageManager.js';
import { validateUpload } from './validateUpload.js';
import File from '#schema/File.js';
import { Post, FeedItems } from '#schema';
import getSettings from '#methods/settings/get.js';

const TIMEOUT_MS = 10_000;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── SSRF protection ───────────────────────────────────────────────────────────

function isPrivateIp(ip) {
  // Unwrap IPv4-mapped IPv6 (::ffff:192.168.1.1)
  const addr = ip.replace(/^::ffff:/i, '');

  if (net.isIPv4(addr)) {
    const [a, b] = addr.split('.').map(Number);
    return (
      a === 0                                     || // 0.0.0.0/8
      a === 10                                    || // 10.0.0.0/8
      a === 127                                   || // 127.0.0.0/8 loopback
      (a === 169 && b === 254)                    || // 169.254.0.0/16 link-local (AWS metadata)
      (a === 172 && b >= 16 && b <= 31)           || // 172.16.0.0/12 private
      (a === 192 && b === 168)                       // 192.168.0.0/16 private
    );
  }

  if (net.isIPv6(addr)) {
    const lower = addr.toLowerCase();
    return (
      lower === '::1'            || // loopback
      lower === '::'             || // unspecified
      lower.startsWith('fc')    || // fc00::/7 unique local
      lower.startsWith('fd')    || // fd00::/8 unique local
      lower.startsWith('fe80')  || // fe80::/10 link-local
      lower.startsWith('::ffff:') // IPv4-mapped — already handled above but belt+suspenders
    );
  }

  return true; // Unknown format — reject
}

async function isSafeUrl(urlStr) {
  let parsed;
  try { parsed = new URL(urlStr); } catch { return false; }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname;

  // Reject localhost variants before DNS lookup
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;

  // If the hostname is already an IP, check it directly
  if (net.isIP(hostname)) return !isPrivateIp(hostname);

  // Resolve to IP and check — rejects unresolvable hostnames too
  try {
    const { address } = await dns.promises.lookup(hostname);
    return !isPrivateIp(address);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function proxyExternalImage({ url, actorId, postId }) {
  try {
    if (!url || !url.startsWith('http')) return;

    if (!await isSafeUrl(url)) {
      console.warn(`[proxyExternalImage] Blocked SSRF attempt: ${url}`);
      return;
    }

    const settings = await getSettings();
    const domain = settings?.domain || process.env.DOMAIN || 'localhost';

    // Fetch with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'kowloon/1.0 (+image-proxy)' },
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return;

    // Guard against oversized images
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_SIZE_BYTES) return;

    const rawBuffer = Buffer.from(await res.arrayBuffer());
    if (!rawBuffer.length || rawBuffer.length > MAX_SIZE_BYTES) return;

    // Validate MIME type, verify magic bytes, sanitize SVGs, re-encode raster images
    let buffer, mimeType;
    try {
      ({ buffer, mimeType } = await validateUpload(rawBuffer, contentType));
    } catch (err) {
      console.warn(`[proxyExternalImage] Rejected ${url}: ${err.message}`);
      return;
    }

    // Derive a filename from the URL path
    let originalFileName = 'image.jpg';
    try {
      const p = new URL(url).pathname;
      const last = p.split('/').pop();
      if (last && last.includes('.')) originalFileName = last;
    } catch {}

    // Upload to storage
    const storage = await getStorageAdapter();
    const result = await storage.upload(buffer, {
      originalFileName,
      actorId,
      contentType: mimeType,
      generateThumbnail: true,
      thumbnailSizes: [200, 400],
      isPublic: false,
    });

    // Map thumbnail storage keys (same pattern as the file upload route)
    let thumbnails = null;
    if (result.thumbnails) {
      thumbnails = {};
      for (const [size] of Object.entries(result.thumbnails)) {
        thumbnails[size] = `thumbnails/${result.key.replace(/\.[^.]+$/, '')}_${size}.webp`;
      }
    }

    // Create the File record
    const file = new File({
      actorId,
      to: '@public',
      parentObject: postId,
      originalFileName,
      name: originalFileName,
      type: 'Image',
      mediaType: result.metadata?.contentType || contentType,
      extension: originalFileName.split('.').pop()?.toLowerCase(),
      url: 'pending',
      size: result.metadata?.size,
      width: result.metadata?.width,
      height: result.metadata?.height,
      storageKey: result.key,
      thumbnails,
    });

    await file.save(); // pre-save sets file.id = file:<_id>@domain
    file.url = `https://${domain}/files/${file.id}`;
    await file.save();

    // Patch the Post and FeedItems with the canonical file: ID
    await Post.updateOne({ id: postId }, { $set: { image: file.id } });
    await FeedItems.updateOne({ id: postId }, { $set: { 'object.image': file.id } });

    return file.id;
  } catch (err) {
    // Non-fatal — a failed proxy must never break post creation
    console.error(`[proxyExternalImage] Failed to proxy ${url}:`, err.message);
  }
}
