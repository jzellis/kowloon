import { getLinkPreview } from "link-preview-js";
const OLD = { followRedirects: "follow" };
const NEW = {
  followRedirects: "follow", handleRedirects: () => true, timeout: 9000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
};
const urls = [
  "https://www.reddit.com/r/programming/",
  "https://www.amazon.com/dp/B08N5WRWNW",
  "https://x.com/nasa",
  "https://arstechnica.com",
];
async function tryOne(u, opts) {
  try { const p = await getLinkPreview(u, opts);
    return p?.title ? `OK  "${p.title.slice(0,40)}"${p.images?.[0]?" +img":""}` : "empty(no title)";
  } catch (e) { return `FAIL ${String(e?.message).slice(0,55)}`; }
}
for (const u of urls) {
  const o = await tryOne(u, OLD); const n = await tryOne(u, NEW);
  console.log(`\n${u}\n  OLD: ${o}\n  NEW: ${n}`);
}
