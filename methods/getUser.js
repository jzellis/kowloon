// getUser.js (canonical IDs are @username@host; route is /users/@user@host)
import get from "./get.js";
import { User } from "../schema/index.js";

// ---- tiny cache ----
const cache = new Map();
const cacheGet = (k) => {
  const v = cache.get(k);
  return v && v.expires > Date.now() ? v.value : null;
};
const cacheSet = (k, value, ttl) =>
  cache.set(k, { value, expires: Date.now() + ttl });

// ---- parsing & normalization ----

/**
 * Normalize any user ref into the canonical Kowloon ID: "@username@host"
 * Accepts:
 *  - "@alice@host.com"  (canonical)
 *  - "alice@host.com"   (acct)
 *  - "https://host.com/users/@alice@host.com" (canonical URL)
 *  - "https://host.com/users/alice" (bare username URL; discouraged)
 *  - "alice"            (bare username -- requires a defaultHost option or returns null)
 */
function normalizeToCanonical(ref, { defaultHost } = {}) {
  if (!ref || typeof ref !== "string") return null;

  // full URL
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    try {
      const u = new URL(ref);
      const parts = u.pathname.split("/").filter(Boolean); // e.g., ["users", "@alice@host.com"] or ["users","alice"]
      if (parts[0] !== "users") return null;
      const tail = parts[1] || "";
      if (tail.startsWith("@") && tail.includes("@", 1)) {
        // looks like "@user@host"
        return tail;
      }
      // fallback: URL ended with bare username; needs host
      if (tail && u.host) return `@${decodeURIComponent(tail)}@${u.host}`;
      return null;
    } catch {
      return null;
    }
  }

  // canonical already?
  if (ref.startsWith("@") && ref.indexOf("@", 1) !== -1) {
    return ref; // "@user@host"
  }

  // acct style "user@host"
  if (ref.includes("@")) {
    const [username, host] = ref.split("@");
    if (!username || !host) return null;
    return `@${username}@${host}`;
  }

  // bare username: only usable if caller gives a defaultHost
  if (defaultHost) return `@${ref}@${defaultHost}`;
  return null;
}

/** Extract { username, host } from canonical "@user@host" */
function splitCanonical(canonicalId) {
  // canonicalId like "@alice@host.com"
  if (!canonicalId?.startsWith("@")) return null;
  const at2 = canonicalId.indexOf("@", 1);
  if (at2 === -1) return null;
  const username = canonicalId.slice(1, at2);
  const host = canonicalId.slice(at2 + 1);
  if (!username || !host) return null;
  return { username, host };
}

/** Build remote user URL for canonical id */
function userUrlFromCanonical(canonicalId) {
  const parts = splitCanonical(canonicalId);
  if (!parts) return null;
  return `https://${parts.host}/users/${encodeURIComponent(canonicalId)}`;
}

// ---- local DB fast-path ----

async function getLocalUserById(
  canonicalId,
  fields = "id username profile prefs publicKey"
) {
  if (!canonicalId) return null;
  return User.findOne({
    id: canonicalId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .select(fields)
    .lean()
    .exec();
}

// ---- remote helpers ----

function pickRemoteUser(payload) {
  if (!payload) return null;
  if (payload.data && typeof payload.data === "object") return payload.data;
  if (payload.id || payload.username || payload.profile) return payload;
  return null;
}

/** WebFinger resolve acct handle to canonical user URL (prefer rel=self activity+json) */
async function webfingerResolve(username, host, { ttlMs = 300_000 } = {}) {
  const key = `wf:${username}@${host}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  const url = `https://${host}/.well-known/webfinger?resource=acct:${encodeURIComponent(
    `${username}@${host}`
  )}`;

  try {
    const resp = await get(url);
    const j = resp?.data;
    const links = Array.isArray(j?.links) ? j.links : [];

    const selfActivity =
      links.find(
        (l) =>
          l?.rel === "self" &&
          typeof l?.type === "string" &&
          l.type.toLowerCase().includes("activity+json")
      ) || links.find((l) => l?.rel === "self" && typeof l?.href === "string");

    if (selfActivity?.href) {
      cacheSet(key, { href: selfActivity.href, subject: j?.subject }, ttlMs);
      return { href: selfActivity.href, subject: j?.subject };
    }
    return null;
  } catch {
    return null;
  }
}

// ---- main ----

/**
 * Retrieve a user by any ref (canonical preferred).
 * @param {string} ref - "@user@host" | "user@host" | URL | "user" (needs defaultHost)
 * @param {object} opts
 * @param {boolean} [opts.cache=true]
 * @param {number}  [opts.ttlMs=60000]            - remote user cache TTL
 * @param {number}  [opts.webfingerTtlMs=300000]  - WebFinger cache TTL
 * @param {string}  [opts.fields]                 - projection for local read
 * @param {string}  [opts.defaultHost]            - used only for bare username inputs
 */
export default async function getUser(
  ref,
  {
    cache: useCache = true,
    ttlMs = 60_000,
    webfingerTtlMs = 300_000,
    fields = "id username profile prefs publicKey",
    defaultHost,
  } = {}
) {
  // 0) Normalize to canonical "@user@host"
  const canonical = normalizeToCanonical(ref, { defaultHost });
  if (!canonical) return null;

  // 1) Local fast path by canonical id
  const local = await getLocalUserById(canonical, fields);
  if (local) return local;

  // 2) Remote fetch URL:
  //    a) If ref was acct or URL -> derive host/username; try WebFinger first
  //    b) Fallback to /users/@user@host
  const parts = splitCanonical(canonical);
  if (!parts) return null;

  let fetchUrl = null;

  // Try WebFinger only if the original ref looked like acct or bare/canonical (not already a URL)
  // (WebFinger helps find the server's canonical actor URL)
  const wf = await webfingerResolve(parts.username, parts.host, {
    ttlMs: webfingerTtlMs,
  });
  if (wf?.href) {
    fetchUrl = wf.href;
  } else {
    fetchUrl = userUrlFromCanonical(canonical);
  }
  if (!fetchUrl) return null;

  // 3) Cache + GET
  const cacheKey = `user:${fetchUrl}`;
  if (useCache) {
    const hit = cacheGet(cacheKey);
    if (hit) return hit;
  }

  try {
    const resp = await get(fetchUrl);
    const user = pickRemoteUser(resp?.data);
    if (!user) return null;
    if (useCache) cacheSet(cacheKey, user, ttlMs);
    return user;
  } catch {
    return null;
  }
}
