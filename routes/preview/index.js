import express from "express";
import { getLinkPreview } from "link-preview-js";
import route from "../utils/route.js";
import { isSafeUrl } from "#methods/utils/safeUrl.js";
import { getSetting } from "#methods/settings/cache.js";
import { buildFileUrl } from "#methods/files/signedUrl.js";
import fetchRemoteServerProfile from "#methods/federation/fetchRemoteServerProfile.js";
import { Page, Post } from "#schema";

const router = express.Router({ mergeParams: true });

// link-preview-js@4 logs a warning on every call when its `resolveDNSHost` hook
// is absent. We deliberately don't use that hook: it makes the library connect
// to a raw IP, which breaks HTTPS certificate validation (cert altname != IP).
// Our isSafeUrl() guard already resolves the host and rejects private / loopback
// / IPv6-loopback targets (the GHSA-4gp8-rjrq-ch6q vectors) before any request,
// so the warning is a false positive for us. Filter just that one line — every
// other console.error passes through untouched.
const _origConsoleError = console.error.bind(console);
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("[link-preview-js] You are not resolving DNS")) return;
  _origConsoleError(...args);
};

// Present as a real browser. link-preview-js's default User-Agent gets blocked
// or served bot-challenge pages by many sites, so previews silently fail even
// for URLs that preview fine elsewhere. A modern Chrome UA + Accept headers is
// the most broadly-compatible choice.
const PREVIEW_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// link-preview-js defaults to a 3s timeout (see its index.js) — too short for
// many sites, so previews silently came back empty. Give slow servers room.
// followRedirects:"follow" already follows all redirect hops (incl. cross-
// domain) via native fetch; handleRedirects only applies in "manual" mode and
// would break multi-hop shortener chains, so we don't use it.
const PREVIEW_TIMEOUT_MS = 9000;

// Recognize a Kowloon object URL by the prefixed, server-qualified ID in its
// path (works for any server). Returns { kowloonId, kowloonType, domain } or
// null. Pages use slugs (no ID in the path), so they're not matched here.
const KOWLOON_URL_TYPES = [
  [/^\/posts\/(post:[^/?#]+@[^/?#]+)/, "Post"],
  [/^\/groups\/(group:[^/?#]+@[^/?#]+)/, "Group"],
  [/^\/circles\/(circle:[^/?#]+@[^/?#]+)/, "Circle"],
  [/^\/bookmarks\/(bookmark:[^/?#]+@[^/?#]+)/, "Bookmark"],
  [/^\/users\/(@[^/?#]+@[^/?#]+)/, "User"],
];
function kowloonRefFromUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  for (const [re, type] of KOWLOON_URL_TYPES) {
    const m = u.pathname.match(re);
    if (m) {
      const kowloonId = decodeURIComponent(m[1]);
      return { kowloonId, kowloonType: type, domain: kowloonId.split("@").pop() };
    }
  }
  return null;
}

// Resolve a stored image value (file ID, relative path, or URL) to an absolute
// URL suitable for a link preview.
function resolveImageUrl(img, domain, protocol) {
  if (!img || typeof img !== "string") return null;
  if (img.startsWith("http")) return img;
  if (img.startsWith("file:")) {
    return buildFileUrl({ fileId: img, domain, protocol, restricted: false });
  }
  if (img.startsWith("/")) return `${protocol}://${domain}${img}`;
  return img;
}

router.get(
  "/",
  route(
    async ({ req, query, set, setStatus }) => {
      const { url } = query;

      if (!url) {
        setStatus(400);
        set("error", "Missing required query parameter: url");
        return;
      }

      const qStart = Date.now();

      // If the link points at a Kowloon object, hand back its canonical ID (so a
      // Link post can store it in `target`) and passively grow our known-servers
      // cache — every shared Kowloon link becomes a server-discovery event, the
      // same way a manual server search does. Fire-and-forget; never blocks the
      // preview. fetchRemoteServerProfile no-ops on our own domain + fresh cache.
      const kref = kowloonRefFromUrl(url);
      if (kref) {
        set("kowloonId", kref.kowloonId);
        set("kowloonType", kref.kowloonType);
        if (kref.domain && kref.domain !== getSetting("domain")) {
          fetchRemoteServerProfile(kref.domain).catch(() => {});
        }
      }

      // If the URL points to a post on this server, fetch from DB directly.
      // The frontend is a SPA and serves no post-specific OG tags, so
      // link-preview-js would return nothing useful for local URLs.
      let parsed;
      try { parsed = new URL(url); } catch { /* fall through to external path */ }

      if (parsed) {
        const domain = getSetting("domain");
        const protocol = req.headers["x-forwarded-proto"] || "https";
        if (domain && parsed.hostname === domain) {
          // Server avatar — the image fallback for any Kowloon object without
          // its own featured image.
          const serverAvatar = resolveImageUrl(
            getSetting("profile")?.icon,
            domain,
            protocol
          );

          // Local post
          const mPost = parsed.pathname.match(/^\/posts\/(post:[^/?#]+@[^/?#]+)/);
          if (mPost) {
            const postId = decodeURIComponent(mPost[1]);
            const post = await Post.findOne({ id: postId })
              .select("title summary source image type")
              .lean();
            if (post) {
              const body = post.source?.content || "";
              set("url", url);
              set("title", post.title || body.slice(0, 100) || null);
              set("summary", post.summary || body.slice(0, 300) || null);
              set(
                "image",
                resolveImageUrl(post.image, domain, protocol) || serverAvatar || null
              );
              set("favicon", serverAvatar || null);
              set("contentType", "text/html");
              set("queryTime", Date.now() - qStart);
              return;
            }
          }

          // Local page — the SPA serves no page-specific OG tags, so resolve
          // from the DB (this is #29: shared pages get title/image/excerpt).
          const mPage = parsed.pathname.match(/^\/pages\/([^/?#]+)/);
          if (mPage) {
            const slugOrId = decodeURIComponent(mPage[1]);
            const page = await Page.findOne({
              $or: [{ slug: slugOrId }, { id: slugOrId }],
            })
              .select("title summary source image")
              .lean();
            if (page) {
              const body = page.source?.content || "";
              set("url", url);
              set("title", page.title || null);
              set("summary", page.summary || body.slice(0, 300) || null);
              set(
                "image",
                resolveImageUrl(page.image, domain, protocol) || serverAvatar || null
              );
              set("favicon", serverAvatar || null);
              set("contentType", "text/html");
              set("queryTime", Date.now() - qStart);
              return;
            }
          }
        }
      }

      // SSRF guard: resolve the host and reject loopback/private/link-local/IPv6
      // targets before link-preview-js makes any request. This is our protection
      // against GHSA-4gp8-rjrq-ch6q — the library's own resolveDNSHost hook is
      // unusable here (it forces a raw-IP connection that breaks HTTPS TLS), so
      // this pre-check is the guard. Residual: redirect *targets* aren't re-checked
      // (the lib follows them internally); acceptable on this authenticated route.
      if (!await isSafeUrl(url)) {
        setStatus(400);
        set("error", "URL is not allowed");
        return;
      }

      try {
        const preview = await getLinkPreview(url, {
          followRedirects: "follow",
          timeout: PREVIEW_TIMEOUT_MS,
          headers: PREVIEW_HEADERS,
        });
        set("url", preview.url);
        set("title", preview.title ?? null);
        set("summary", preview.description ?? null);
        set("contentType", preview.contentType ?? null);
        set("image", preview.images?.[0] ?? null);
        set("favicon", preview.favicons?.[0] ?? null);
      } catch {
        // Return an empty preview rather than an error — caller decides what to do
        set("url", url);
        set("title", null);
        set("summary", null);
        set("contentType", null);
        set("image", null);
        set("favicon", null);
      }

      set("queryTime", Date.now() - qStart);
    },
    { allowUnauth: false }
  )
);

export default router;
