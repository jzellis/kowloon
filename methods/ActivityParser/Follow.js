import { User, Feed, Circle, FeedItem } from "../../schema/index.js";
import isLocal from "../isLocal.js";
import login from "../login.js";
import Parser from "rss-parser";
export default async function (activity) {
  let newFollowId;
  let user = await User.findOne({ id: activity.actorId });
  let userFollowingCircle = await Circle.findOne({ id: user.following });
  // let isLocalFeed = await isLocal(activity.target);
  let newFeed = {};
  let feedItems = [];
  let feed = await Feed.findOne({
    $or: [{ id: activity.target }, { href: activity.target }],
  });

  if (feed) {
    newFollowId = feed.id;
  } else {
    let remoteFeed = await fetch(activity.target, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        mode: "no-cors",
        Accept: "application/json",
        "kowloon-id": user.id,
        Authorization: `Basic ${user.keys.public.replaceAll("\n", "\\r\\n")}`,
      },
    });

    let contentType = remoteFeed.headers.get("Content-Type");
    console.log(contentType);
    switch (true) {
      case contentType.includes("xml"):
        console.log("is RSS");
        let parser = new Parser();
        feed = await parser.parseURL(activity.target);
        newFeed = await Feed.create({
          type: "rss",
          title: feed.title,
          href: feed.link,
          summary: feed.description,
          icon: feed.image.url,
        });

        feedItems = feed.items.map((item) => {
          console.log(item);
          return {
            feedId: newFeed.id,
            object: {
              actor: {
                id: newFeed.id,
                profile: {
                  name: feed.title,
                  icon: feed.image.url,
                  bio: feed.description,
                  urls: [activity.target],
                },
              },
              type: "Article",
              title: item.title,
              to: ["@public"],
              summary: item.contentSnippet,
              href: item.link,
              createdAt: item.pubDate,
              source: {
                content: item.content,
                mediaType: "text/html",
              },
            },
          };
        });
        await FeedItem.insertMany(feedItems);
        break;
      case contentType.includes("kowloon"):
        feed = await remoteFeed.json();
        newFeed = await Feed.create({
          title: feed.title,
          href: activity.target,
          summary: feed.actor.profile.bio,
          icon: feed.actor.profile.icon,
        });
        feedItems = feed.items.map((item) => {
          return {
            feedId: newFeed.id,
            object: { ...item, actor: feed.actor },
          };
        });
        await FeedItem.insertMany(feedItems);

        break;
    }
  }
  activity.objectId = (await Feed.create(newFeed)).id;
  userFollowingCircle.members.push(newFollowId);
  await userFollowingCircle.save();

  return activity;
}
