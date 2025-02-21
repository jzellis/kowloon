import Parser from "rss-parser";
import fs from "fs/promises";

let url = "https://www.theguardian.com/uk/rss";

const parser = new Parser();

let feed = await parser.parseURL(url);

await fs.writeFile("rssfeed.json", JSON.stringify(feed, null, 2), "utf-8");
process.exit(0);
