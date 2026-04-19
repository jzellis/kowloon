// methods/seo/sitemap.js
import { FeedItems, User, Group, Page } from "#schema";
import { getSetting } from "#methods/settings/cache.js";

function xmlDate(d) {
  return d ? new Date(d).toISOString() : new Date().toISOString();
}

function urlEntry(loc, lastmod, changefreq = "weekly", priority = "0.5") {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${xmlDate(lastmod)}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function generateSitemap(req) {
  const domain = getSetting("domain") || req.hostname;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${domain}`;

  const [posts, users, groups, pages] = await Promise.all([
    FeedItems.find({ to: "public", tombstoned: { $ne: true }, objectType: "Post" })
      .sort({ publishedAt: -1 }).limit(1000).select("id publishedAt updatedAt").lean(),
    User.find({ active: true }).select("id username updatedAt").lean(),
    Group.find({ to: "@public", deletedAt: null }).select("id updatedAt").lean(),
    Page.find({ deletedAt: null }).select("slug id updatedAt").lean(),
  ]);

  const entries = [
    urlEntry(`${base}/`, new Date(), "daily", "1.0"),
    ...posts.map((p) => urlEntry(`${base}/posts/${encodeURIComponent(p.id)}`, p.updatedAt || p.publishedAt, "monthly", "0.7")),
    ...users.map((u) => urlEntry(`${base}/users/${encodeURIComponent(u.id)}`, u.updatedAt, "weekly", "0.5")),
    ...groups.map((g) => urlEntry(`${base}/groups/${encodeURIComponent(g.id)}`, g.updatedAt, "weekly", "0.6")),
    ...pages.map((p) => urlEntry(`${base}/pages/${encodeURIComponent(p.slug || p.id)}`, p.updatedAt, "weekly", "0.8")),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;
}
