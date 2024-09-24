import Parser from "rss-parser";
import { Feed } from "../../schema/index.js";
import slugify from "slugify";
import { URL } from "url";

export default async function (url, actorId) {
  const parser = new Parser();
  try {
    let feed = await parser.parseURL(url);

    if (feed) {
      let url = new URL(f.url);
      let domain = url.hostname;
      let feedActor = {
        id: `@feed@${domain}`,
        username: slugify(feed.title),
        profile: {
          name: feed.title,
          icon: feed.image?.url,
        },
      };

      feed.items.map(async (item) => {
        await Feed.findOneAndUpdate(
          { id: item.guid },
          {
            $set: {
              id: item.guid,
              $addToSet: {
                to: { $each: item.to },
                bto: { $each: item.bto },
                cc: { $each: item.cc },
                bcc: { $each: item.bcc },
              },
              item: {
                type: "Article",
                source: {
                  mediaType: "text/html",
                  content: item.content,
                },
                summary: item.contentSnippet || null,
                title: item.title || null,
                actorId: feedActor.id,
                actor: feedActor,
                url: item.link,
                createdAt: new Date(item.pubDate),
              },
            },
          },
          { upsert: true }
        );
      });
    }
  } catch (e) {
    return new Error(e);
  }
}
