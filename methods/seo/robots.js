// methods/seo/robots.js
import { getSetting } from "#methods/settings/cache.js";

export function generateRobots(req) {
  const domain = getSetting("domain") || req.hostname;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `User-agent: *
Allow: /
Allow: /posts/
Allow: /users/
Allow: /groups/
Allow: /pages/

Disallow: /admin/
Disallow: /auth/
Disallow: /register
Disallow: /outbox
Disallow: /inbox
Disallow: /files/
Disallow: /notifications/
Disallow: /bookmarks/

Sitemap: ${proto}://${domain}/sitemap.xml
`;
}
