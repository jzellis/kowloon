import { Activity, Inbox, User } from "../schema/index.js";
import Parser from "rss-parser";
import slugify from "slugify";

export default async function (userId, options) {
  let qStart = Date.now();
  let user = await User.findOne({ id: userId });

  let parser = new Parser();
  options = {
    page: 1,
    pageLength: 20,
    summary: `${user.username} | Inbox`,
    id: `//${this.settings.domain}/${user.username}/inbox`,
    ordered: true,
    ...options,
  };

  let following = user.following;

  await Promise.all(
    following.map(async (follow) => {
      let url = follow.url;
      switch (follow.type) {
        case "kowloon":
          url += "/posts";

          try {
            let request = await fetch(url, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Basic ${user.keys.public.replaceAll(
                  "\n",
                  "\\r\\n"
                )}`,
              },
            });
            let result = await request.json();
            await Promise.all(
              result.items.map(async (item) => {
                item = { rss: false, ...item };
                await Inbox.findOneAndUpdate(
                  { "item.id": item.id },
                  {
                    actor: user.id,
                    item: item,
                  },
                  { upsert: true, new: true, setDefaultsOnInsert: true }
                );
              })
            );
          } catch (e) {
            console.error(e);
          }
          break;
        case "rss":
          let feed = await parser.parseURL(url);
          await Promise.all(
            feed.items.map(
              async (item) =>
                await Inbox.findOneAndUpdate(
                  { "item.id": item.guid },
                  {
                    actor: user.id,
                    item: {
                      rss: true,
                      type: "Article",
                      id: item.guid || undefined,
                      title: item.title || undefined,
                      summary: item.contentSnippet || undefined,
                      url: item.link || undefined,
                      public: true,
                      publicReplies: false,
                      createdAt: new Date(item.isoDate || item.pubDate),
                      updatedAt: new Date(item.isoDate || item.pubDate),

                      source: {
                        mediaType: "text/html",
                        content: item.content || undefined,
                      },
                      actor: {
                        id: `@${slugify(feed.title, { lower: true })}@${
                          feed.link.split("/")[2]
                        }`,
                        name: feed.title || undefined,
                        url: feed.feedUrl || undefined,
                        icon: feed.image.url || undefined,
                      },
                    },
                  },
                  { upsert: true, new: true, setDefaultsOnInsert: true }
                )
            )
          );

          break;
      }
    })
  );

  let totalInbox = await Inbox.countDocuments({ actor: userId });

  let posts = (
    await Inbox.find({
      actor: userId,
      read: false,
    })
      .select("item")
      .limit(options.pageLength)
      .skip((options.page - 1) * options.pageLength)
  ).map((item) => item.item);

  let qEnd = Date.now();
  let response = {
    "@context": "https://www.w3.org/ns/Poststreams",
    type: options.ordered ? "OrderedCollection" : "Collection",
    id: options.id,
    summary: `${this.settings.title} | ${options.summary}`,
    totalItems: posts.length,
    first: 1,
    current: parseInt(options.page) || 1,
    last: Math.ceil(totalInbox / options.pageLength),
    items: posts,
    queryTime: qEnd - qStart,
  };
  return response;
}
