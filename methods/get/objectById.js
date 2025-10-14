// methods/getObjectById.js
import kowloonId from "#methods/parse/kowloonId.js";
import getSettings from "#methods/settings/get.js";

// ---------- Errors ----------
export class NotFound extends Error {
  constructor(msg) {
    super(msg);
    this.name = "NotFound";
  }
}
export class NotAuthorized extends Error {
  constructor(msg) {
    super(msg);
    this.name = "NotAuthorized";
  }
}
export class UpstreamError extends Error {
  constructor(msg, status) {
    super(msg);
    this.name = "UpstreamError";
    this.status = status;
  }
}
export class BadRequest extends Error {
  constructor(msg) {
    super(msg);
    this.name = "BadRequest";
  }
}

// ---------- Optional lazy models (avoid if you can inject) ----------
let _cachedModels = null;
async function getDefaultModels() {
  if (_cachedModels) return _cachedModels;
  const mod = await import("#schema");
  _cachedModels = mod;
  return _cachedModels;
}

// ---------- Utils ----------
async function defaultFetch(url, { headers, timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

const isLocal = (server, localDomain) =>
  String(server || "").toLowerCase() ===
  String(localDomain || "").toLowerCase();

const authHeaders = ({ bearer, extra } = {}) => {
  const h = new Headers({ Accept: "application/json" });
  if (bearer) h.set("Authorization", `Bearer ${bearer}`);
  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
};

const isExpired = (iso, sec) =>
  !iso || (Date.now() - Date.parse(iso)) / 1000 > sec;

const hasPath = (Model, path) => {
  try {
    return !!Model?.schema?.path?.(path);
  } catch {
    return false;
  }
};

function modelFor(type, models) {
  if (!type || !models) return null;
  const key = String(type).charAt(0).toUpperCase() + String(type).slice(1);
  const model = models[key];
  if (!model) return null;
  const remotePath =
    {
      Activity: "/activities",
      Post: "/posts",
      Reply: "/replies",
      Event: "/events",
      Group: "/groups",
      Circle: "/circles",
      File: "/files",
      React: "/reacts",
      Bookmark: "/bookmarks",
      User: "/users",
    }[key] || `/${key.toLowerCase()}s`;
  return { model, typeName: key, remotePath };
}

// Handles: "@name@domain" → { username, server }
function parseHandle(h) {
  const m = typeof h === "string" ? h.match(/^@([^@]+)@(.+)$/) : null;
  return m ? { username: m[1], server: m[2] } : null;
}

// Build public-only filter for anonymous viewers (no viewerId).
// We try to be schema-aware: if model has 'visibility' or 'to' (string of space-separated ids).
function buildAnonymousFilter(Model) {
  const useVis = hasPath(Model, "visibility");
  const useTo = hasPath(Model, "to");
  if (useVis && useTo)
    return { $or: [{ visibility: "public" }, { to: /(^| )@public( |$)/ }] };
  if (useVis) return { visibility: "public" };
  if (useTo) return { to: /(^| )@public( |$)/ };
  // If neither field exists, default to allowing (most Users/Groups have no per-doc ACL fields)
  return {};
}

// Prefer universal /resolve; otherwise try resource urls
function buildResolveUrlForObject(id, type, server) {
  const u = new URL(`https://${server}/resolve`);
  u.searchParams.set("id", id);
  return u.toString();
}
function buildResolveUrlsForUserHandle({ username, server }) {
  // Try /resolve?id=@name@domain then actor urls
  return [
    (() => {
      const u = new URL(`https://${server}/resolve`);
      u.searchParams.set("id", `@${username}@${server}`);
      return u.toString();
    })(),
    `https://${server}/users/${encodeURIComponent(username)}`,
    `https://${server}/users/${encodeURIComponent(username)}@${server}`,
  ];
}

// ---------- Main ----------
/**
 * getObjectById(id, opts?)
 *  - id: "@name@domain" OR "type:<_id>@domain"
 */
export default async function getObjectById(
  id,
  {
    viewerId = null,
    mode = "prefer-local", // "local" | "remote" | "prefer-local" | "both"
    enforceLocalVisibility = true,
    hydrateRemoteIntoDB = true,
    maxStaleSeconds = 0,
    timeoutMs = 8000,
    fetcher = defaultFetch,
    getBearerForDomain = null,
    models = null, // optional: inject to avoid lazy import cycles
    canView = async () => true, // your ACL for local docs when viewerId present
  } = {}
) {
  if (!id) throw new BadRequest("Missing id");
  const Models = models || (await getDefaultModels());
  const settings = await getSettings();
  const localDomain = (
    settings?.domain ||
    process.env.DOMAIN ||
    ""
  ).toLowerCase();

  // ---- A) User handle (@name@domain) ----
  const handle = id.startsWith("@") ? parseHandle(id) : null;
  if (handle) {
    const local = isLocal(handle.server, localDomain);

    // 1) Local
    if (
      local ||
      mode === "local" ||
      mode === "prefer-local" ||
      mode === "both"
    ) {
      const actorUrl1 = `https://${handle.server}/users/${handle.username}`;
      const actorUrl2 = `https://${handle.server}/users/${handle.username}@${handle.server}`;
      const doc =
        (await Models.User.findOne({ id }).lean()) ||
        (await Models.User.findOne({ id: actorUrl1 }).lean()) ||
        (await Models.User.findOne({ id: actorUrl2 }).lean());

      if (doc) {
        // If you want "private profiles" enforced, put that in canView(User).
        if (
          enforceLocalVisibility &&
          viewerId &&
          !(await canView(viewerId, doc))
        ) {
          throw new NotAuthorized("Not visible");
        }
        return {
          object: doc,
          source: "local",
          visibility: doc.visibility || "unknown",
          cached: false,
        };
      }
      if (local && mode !== "remote" && mode !== "both")
        throw new NotFound(`User not found: ${id}`);
    }

    // 2) Remote
    if (
      !isLocal(handle.server, localDomain) &&
      (mode === "remote" || mode === "prefer-local" || mode === "both")
    ) {
      const urls = buildResolveUrlsForUserHandle(handle);
      let lastErr = null;

      // Optional cached user shadow
      let cached = null;
      if (maxStaleSeconds > 0) {
        cached = await Models.User.findOne({ id }).lean();
        if (cached && !isExpired(cached.lastFetchedAt, maxStaleSeconds)) {
          return {
            object: cached,
            source: "remote",
            visibility: cached.visibility || "unknown",
            cached: true,
            fetchedAt: cached.lastFetchedAt,
          };
        }
      }

      // Try each URL until one works
      let res = null,
        urlHit = null;
      let bearer = null;
      if (getBearerForDomain) {
        try {
          bearer = await getBearerForDomain(viewerId, handle.server);
        } catch {}
      }
      const headers = authHeaders({
        bearer,
        extra: cached?.etag ? { "If-None-Match": cached.etag } : undefined,
      });

      for (const url of urls) {
        try {
          res = await fetcher(url, { headers, timeoutMs });
          urlHit = url;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!res)
        throw new UpstreamError(lastErr?.message || "Remote fetch failed", 502);

      if (res.status === 304 && cached) {
        await Models.User.findOneAndUpdate(
          { id },
          { lastCheckedAt: new Date().toISOString() }
        );
        return {
          object: cached,
          source: "remote",
          visibility: cached.visibility || "unknown",
          cached: true,
          fetchedAt: cached.lastFetchedAt,
        };
      }
      if (res.status === 401 || res.status === 403)
        throw new NotAuthorized(`Unauthorized at ${handle.server}`);
      if (res.status === 404)
        throw new NotFound(`Remote user not found: ${id}`);
      if (res.status >= 500)
        throw new UpstreamError(
          `Upstream error from ${handle.server}`,
          res.status
        );

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json"))
        throw new UpstreamError(
          `Unexpected content-type from ${urlHit}`,
          res.status
        );

      const payload = await res.json();
      const etag = res.headers.get("etag") || undefined;

      let hydrated = payload;
      if (hydrateRemoteIntoDB) {
        const now = new Date().toISOString();
        hydrated = await Models.User.findOneAndUpdate(
          { id: payload.id || id },
          { ...payload, etag, originDomain: handle.server, lastFetchedAt: now },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
      }
      return {
        object: hydrated,
        source: "remote",
        visibility: hydrated?.visibility || "unknown",
        cached: false,
        fetchedAt: new Date().toISOString(),
      };
    }

    throw new NotFound(`User not found: ${id}`);
  }

  // ---- B) Object id (type:<_id>@domain) ----
  const parsed = kowloonId(id); // { type, server, mongoId, id }
  if (!parsed?.type || !parsed?.server)
    throw new BadRequest(`Invalid id: ${id}`);
  const entry = modelFor(parsed.type, Models);
  if (!entry) throw new BadRequest(`Unsupported type: ${parsed.type}`);

  // Local helpers
  const localFind = async () =>
    entry.model.findOne({ id, deletedAt: null }).lean();
  const localFindVisible = async () => {
    let baseFilter = { id, deletedAt: null };
    // Anonymous → public-only filter
    if (!viewerId && enforceLocalVisibility) {
      baseFilter = { ...baseFilter, ...buildAnonymousFilter(entry.model) };
    }
    const doc = await entry.model.findOne(baseFilter).lean();
    if (doc && viewerId && enforceLocalVisibility) {
      const ok = await canView(viewerId, doc);
      if (!ok) return null;
    }
    return doc;
  };

  const local = isLocal(parsed.server, localDomain);

  // 1) Local
  if (local || mode === "local" || mode === "prefer-local" || mode === "both") {
    const doc = await localFindVisible();
    if (doc)
      return {
        object: doc,
        source: "local",
        visibility: doc.visibility || "unknown",
        cached: false,
      };
    if (local && mode !== "remote" && mode !== "both")
      throw new NotFound(`Local object not found: ${id}`);
  }

  // 2) Remote
  if (
    !local &&
    (mode === "remote" || mode === "prefer-local" || mode === "both")
  ) {
    // optional cached shadow
    let cached = null;
    if (maxStaleSeconds > 0) {
      cached = await entry.model
        .findOne({ id, originDomain: parsed.server, deletedAt: null })
        .lean();
      if (cached && !isExpired(cached.lastFetchedAt, maxStaleSeconds)) {
        return {
          object: cached,
          source: "remote",
          visibility: cached.visibility || "unknown",
          cached: true,
          fetchedAt: cached.lastFetchedAt,
        };
      }
    }

    const url = buildResolveUrlForObject(id, parsed.type, parsed.server);
    let bearer = null;
    if (getBearerForDomain) {
      try {
        bearer = await getBearerForDomain(viewerId, parsed.server);
      } catch {}
    }
    const headers = authHeaders({
      bearer,
      extra: cached?.etag ? { "If-None-Match": cached.etag } : undefined,
    });

    const res = await fetcher(url, { headers, timeoutMs });

    if (res.status === 304 && cached) {
      await entry.model.findOneAndUpdate(
        { id },
        { lastCheckedAt: new Date().toISOString() }
      );
      return {
        object: cached,
        source: "remote",
        visibility: cached.visibility || "unknown",
        cached: true,
        fetchedAt: cached.lastFetchedAt,
      };
    }
    if (res.status === 401 || res.status === 403)
      throw new NotAuthorized(`Unauthorized at ${parsed.server}`);
    if (res.status === 404)
      throw new NotFound(`Remote object not found: ${id}`);
    if (res.status >= 500)
      throw new UpstreamError(
        `Upstream error from ${parsed.server}`,
        res.status
      );

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json"))
      throw new UpstreamError(
        `Unexpected content-type from ${parsed.server}`,
        res.status
      );

    const payload = await res.json();
    const etag = res.headers.get("etag") || undefined;

    let hydrated = payload;
    if (hydrateRemoteIntoDB) {
      const now = new Date().toISOString();
      hydrated = await entry.model
        .findOneAndUpdate(
          { id: payload.id || id },
          {
            ...payload,
            originDomain: parsed.server,
            etag,
            lastFetchedAt: now,
            deletedAt: null,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        .lean();
    }
    return {
      object: hydrated,
      source: "remote",
      visibility: hydrated?.visibility || "unknown",
      cached: false,
      fetchedAt: new Date().toISOString(),
    };
  }

  throw new NotFound(`Object not found: ${id}`);
}
