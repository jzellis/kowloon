import Parser from "rss-parser";
import fs from "fs/promises";
import { getLinkPreview } from "link-preview-js";

let url = "https://www.theguardian.com/uk/rss";

const parser = new Parser();

let feed = await parser.parseURL(url);

let items = [];

await Promise.all(
  feed.items.map(async (i) => {
    let preview = await getLinkPreview(i.link);
    items.push({
      id: `post:${i.link}`,
      actorId: `feed:${url}`,
      to: ["@admin@kwln.org"],
      title: i.title,
      url: i.link,
      createdAt: i.pubDate,
      body: i.content,
      image: preview.images[0],
    });
  })
);

await fs.writeFile("rssfeed.json", JSON.stringify(feed, null, 2), "utf-8");
process.exit(0);
