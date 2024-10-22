import Parser from "rss-parser";
import { getLinkPreview } from "link-preview-js";

import { Feed } from "../../schema/index.js";
import slugify from "slugify";
import { URL } from "url";

export default async function (url, actorId) {
  const parser = new Parser();
  try {
    let feed = await parser.parseURL(url);

    url = new URL(url);
    let domain = url.hostname;
    let feedActor = {
      id: `@feed@${domain}`,
      username: slugify(feed.title),
      profile: {
        name: feed.title,
        icon: feed.image?.url,
      },
    };

    await Promise.all(
      feed.items.map(async (item) => {
        let image = null;
        try {
          let preview = await getLinkPreview(item.link, {
            headers: {
              "user-agent": "googlebot",
              "Accept-Language": "en-US",
            },
            followRedirects: true,
            timeout: 5000,
          });
          if (preview.images[0]) image = preview.images[0];
        } catch (e) {}
        await Feed.findOneAndUpdate(
          { id: item.guid },
          {
            $addToSet: {
              to: actorId,
            },
            $set: {
              id: item.guid,
              object: {
                id: item.guid,
                type: "Article",
                title: item.title || null,
                summary: item.contentSnippet || null,
                source: { content: item.content || null },
                url: item.link,
                href: item.href,
                image: image,
                createdAt: item.pubDate,
                actorId: feedActor.id,
                tags: item.categories || null,
              },
            },
          },
          { upsert: true, new: true }
        );
      })
    );
  } catch (e) {
    console.log(e);
    return new Error(e);
  }
}
