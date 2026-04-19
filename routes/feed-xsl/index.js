// routes/feed-xsl/index.js
// GET /feed.xsl — XSLT stylesheet for browser-rendering of RSS feeds.
// Feed readers ignore this; browsers use it to display a styled page.

import express from "express";

const router = express.Router();

const XSL = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title><xsl:value-of select="/rss/channel/title"/></title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=IBM+Plex+Sans:wght@400;600&amp;family=Source+Serif+4:ital,wght@0,400;0,600;1,400&amp;display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'IBM Plex Sans', sans-serif;
      background: #f5f0e8;
      color: #1a1a2e;
      min-height: 100vh;
    }

    header {
      background: #1a1a2e;
      color: #f5f0e8;
      padding: 2rem 2.5rem;
      display: flex;
      align-items: flex-end;
      gap: 2rem;
      border-bottom: 4px solid #4a1942;
    }

    .feed-badge {
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      background: #c0392b;
      color: #fff;
      padding: 0.25rem 0.6rem;
      margin-bottom: 0.4rem;
      display: inline-block;
    }

    header h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(2rem, 5vw, 3.5rem);
      letter-spacing: 0.04em;
      line-height: 1;
      color: #f5f0e8;
    }

    header p {
      font-size: 0.85rem;
      color: #f5f0e8;
      opacity: 0.6;
      margin-top: 0.4rem;
      letter-spacing: 0.02em;
    }

    .subscribe-bar {
      background: #4a1942;
      color: #f5f0e8;
      padding: 0.75rem 2.5rem;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .subscribe-bar a {
      color: #f5f0e8;
      font-weight: 600;
      word-break: break-all;
    }

    main {
      max-width: 780px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    article {
      border-top: 2px solid #1a1a2e;
      padding: 1.75rem 0;
    }

    article:last-child {
      border-bottom: 2px solid #1a1a2e;
    }

    .item-meta {
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #4a1942;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    article h2 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.6rem;
      letter-spacing: 0.04em;
      line-height: 1.1;
      margin-bottom: 0.6rem;
    }

    article h2 a {
      color: #1a1a2e;
      text-decoration: none;
    }

    article h2 a:hover {
      color: #4a1942;
    }

    article p {
      font-family: 'Source Serif 4', serif;
      font-size: 1rem;
      line-height: 1.65;
      color: #333;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="feed-badge">RSS Feed</div>
      <h1><xsl:value-of select="/rss/channel/title"/></h1>
      <p><xsl:value-of select="/rss/channel/description"/></p>
    </div>
  </header>

  <div class="subscribe-bar">
    <span>Subscribe:</span>
    <a href="{/rss/channel/atom:link/@href}">
      <xsl:value-of select="/rss/channel/atom:link/@href"/>
    </a>
  </div>

  <main>
    <xsl:for-each select="/rss/channel/item">
      <article>
        <div class="item-meta">
          <xsl:if test="author">
            <xsl:value-of select="author"/>
            <xsl:text> &#8212; </xsl:text>
          </xsl:if>
          <xsl:value-of select="pubDate"/>
        </div>
        <h2>
          <a href="{link}"><xsl:value-of select="title"/></a>
        </h2>
        <xsl:if test="description != ''">
          <p><xsl:value-of select="description"/></p>
        </xsl:if>
      </article>
    </xsl:for-each>
  </main>
</body>
</html>
</xsl:template>
</xsl:stylesheet>`;

router.get("/feed.xsl", (_req, res) => {
  res.set("Content-Type", "text/xsl").send(XSL);
});

export default router;
