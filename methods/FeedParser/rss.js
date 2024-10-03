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

              item: {
                id: item.guid,
                type: "Article",
                title: item.title || null,
                content_text: item.contentSnippet || null,
                content_html: item.content || null,
                url: item.link,
                external_url: item.href,
                image: image,
                date_published: item.pubDate,
                // date_modified: object.updatedAt,
                author: item.author,
                // tags: item.categories || null,
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
