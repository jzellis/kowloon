// methods/files/signedUrl.js
// App-level signed file URLs.
//
// Files stream through GET /files/:id from internal object storage (no public
// storage surface). Public files serve to anyone, so they get a plain, stable,
// cacheable URL that federation peers can fetch indefinitely. Restricted files
// can't be loaded by a bare <img> tag (browsers don't send the Authorization
// header), so the API embeds a short-lived signature that grants access to that
// one file — the same property presigned S3 URLs gave us, without exposing the
// viewer's JWT or a public storage endpoint.

import crypto from "crypto";

function secret() {
  // Same secret the app already holds; present in the app and worker envs.
  return process.env.JWT_SECRET || process.env.FILE_URL_SECRET || "";
}

// Size is intentionally NOT part of the signature so clients can append
// &size=<n> to fetch a thumbnail of the same (already-authorized) file.
function sign(fileId, exp) {
  return crypto
    .createHmac("sha256", secret())
    .update(`${fileId}:${exp}`)
    .digest("base64url");
}

export function verifyFileSig(fileId, exp, sig) {
  if (!fileId || !exp || !sig || !secret()) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;
  const expected = sign(fileId, String(exp));
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Treat empty/`@public`/`public` as public; everything else (server, circle,
// group, user IDs) is restricted.
export function isPublicVisibility(to) {
  const v = String(to ?? "").trim().toLowerCase();
  return v === "" || v === "@public" || v === "public";
}

// Build the public URL for a file served by GET /files/:id.
export function buildFileUrl({ fileId, domain, protocol = "https", restricted = false, ttlSeconds = 3600 }) {
  // Keep the file id raw (no encoding) to match the URLs the rest of the
  // codebase builds (upload.js, proxyExternalImage.js) and the frontend's
  // sizedUrl regex, which keys on a literal `file:`. File ids contain no '/'.
  const base = `${protocol}://${domain}/files/${fileId}`;
  if (!restricted) return base;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${base}?exp=${exp}&sig=${sign(fileId, String(exp))}`;
}
