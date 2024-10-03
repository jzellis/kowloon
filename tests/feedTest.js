import Parser from "rss-parser";
import { getLinkPreview } from "link-preview-js";
let parser = new Parser();

let preview = await getLinkPreview(
  "https://www.nytimes.com/2024/09/28/world/middleeast/hezbollah-hassan-nasrallah-next-steps.html",
  {
    headers: {
      "user-agent": "googlebot",
      "Accept-Language": "en-US",
    },
    followRedirects: true,
  }
);
console.log(preview);
