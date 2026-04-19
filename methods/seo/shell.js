// methods/seo/shell.js
// Render a minimal HTML shell with full <head> meta tags for bots/crawlers.

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderShell({ title, description, image, url, type, siteName, jsonLd }) {
  const t = esc(title);
  const d = esc(description);
  const i = esc(image || "");
  const u = esc(url);
  const s = esc(siteName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <link rel="canonical" href="${u}">

  <!-- Open Graph -->
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:url" content="${u}">
  <meta property="og:site_name" content="${s}">
  <meta property="og:type" content="${esc(type || "website")}">
  ${i ? `<meta property="og:image" content="${i}">` : ""}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="${i ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  ${i ? `<meta name="twitter:image" content="${i}">` : ""}

  ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
</head>
<body></body>
</html>`;
}
