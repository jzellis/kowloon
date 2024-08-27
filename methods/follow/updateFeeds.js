import { User, Inbox, Post } from "../../schema/index.js";
import get from "../remote/get.js";
import post from "../remote/post.js";
import Parser from "rss-parser";
import slugify from "slugify";
import url, { URL } from "url";

export default async function (actorId) {
  let parser = new Parser();
  let user = await User.findOne({
    $or: [{ id: actorId }, { username: actorId }],
  });
  let items = [];
  if (user) {
    await Promise.all(
      user.following.map(async (f) => {
        let inboxItem = {
          to: actorId,
          item: {},
        };
        switch (f.type) {
          case "kowloon":
            let url = f.url + "posts";
            try {
              let response = await get(url, actorId);
              let items = response.items;
              items.map(async (item) => {
                item.rss = false;
                await Inbox.findOneAndUpdate(
                  { id: item.id },
                  { $set: { to: actorId, item } },
                  { upsert: true }
                );
              });
            } catch (e) {
              console.log(`Failed to get ${url}: ${e}`);
              return;
            }
            break;
          case "rss":
            let feed = await parser.parseURL(f.url);
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
                await Inbox.findOneAndUpdate(
                  { id: item.guid },
                  {
                    $set: {
                      to: actorId,
                      item: {
                        rss: true,
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
            break;
        }
      })
    );
    return true;
  } else {
    return new Error("User not found");
  }
}
