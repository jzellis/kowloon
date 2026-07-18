import express from "express";
import { getLinkPreview } from "link-preview-js";
import route from "../utils/route.js";
import { isSafeUrl } from "#methods/utils/safeUrl.js";
import { getSetting } from "#methods/settings/cache.js";
import { buildFileUrl } from "#methods/files/signedUrl.js";
import { Page, Post } from "#schema";

const router = express.Router({ mergeParams: true });

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

      // SSRF guard: reject loopback/private/link-local hosts before letting
      // link-preview-js make any request. This is the workaround the v4
      // advisory recommends for users who can't upgrade — and we can't, since
      // link-preview-js@4.x ships ESM imports without .js extensions and
      // won't load under Node's native ESM. See package.json overrides.
      if (!await isSafeUrl(url)) {
        setStatus(400);
        set("error", "URL is not allowed");
        return;
      }

      try {
        const preview = await getLinkPreview(url, { followRedirects: "follow" });
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
