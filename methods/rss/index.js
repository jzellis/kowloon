// methods/rss/index.js
// Serialize feed items to RSS 2.0 XML.

function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(date) {
  return date ? new Date(date).toUTCString() : "";
}

/**
 * @param {object[]} items     - feedItemToPost()-shaped objects
 * @param {object}   feedMeta
 * @param {string}   feedMeta.title
 * @param {string}   feedMeta.link        - canonical URL of the feed's HTML page
 * @param {string}   feedMeta.feedLink    - URL of this RSS feed itself
 * @param {string}   [feedMeta.description]
 * @param {string}   [feedMeta.domain]
 */
export function toRSS(items, { title, link, feedLink, description = "", domain = "" }) {
  const itemsXml = items.map((item) => {
    const postUrl = `https://${domain}/posts/${encodeURIComponent(item.id)}`;
    const content = item.source?.content ?? item.body ?? item.content ?? item.name ?? "";
    const author = item.actor?.name ?? item.actor?.preferredUsername ?? item.actorId ?? "";

    return `    <item>
      <title>${escapeXml(item.name || item.type || "Post")}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${rfc822(item.publishedAt)}</pubDate>
      ${author ? `<author>${escapeXml(author)}</author>` : ""}
      <description>${escapeXml(content)}</description>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <atom:link href="${escapeXml(feedLink)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${rfc822(new Date())}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;
}
