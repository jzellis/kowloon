import { User, Circle, Post, CachedPosts, UserFeed } from "../schema/index.js";
import getSettings from "./getSettings.js";
import Parser from "rss-parser";
import { getLinkPreview } from "link-preview-js";
import generateToken from "./generateToken.js";

export default async function (actorId, circleId) {
  let user = await User.findOne({ id: actorId });
  const settings = await getSettings();
  const token = await generateToken(actorId);
  const circle = await Circle.findOne({ id: circleId });
  if (!circle) {
    return new Error("Circle not found");
  }

  let cachedPosts = [];
  let userFeed = [];

  await Promise.all(
    circle.members.map(async (m) => {
      switch (m.type) {
        case "kowloon":
          const url = `${m.outbox}`;
          const headers = {
            "Content-Type": "application/activity+json",
            Authorization: `Bearer ${token}`,
            Accept: "application/activity+json",
          };

          let req = await fetch(url, {
            method: "GET",
            headers: headers,
          });
          if (req.ok) {
            let response = await req.json();
            let items = response.items || [];
            items.forEach((i) => {
              let { canReact, canReply, canShare, ...post } = i;
              cachedPosts.push(post);
              userFeed.push({
                actorId,
                canReact,
                canReply,
                canShare,
                postId: post.id,
                circleId,
              });
            });
          }
          break;

        case "rss":
          let rss = await parser.parseURL(m.outbox);
          await Promise.all(
            rss.items.map(async (i) => {
              let preview = await getLinkPreview(i.link);

              return {
                id: `post:${i.link}`,
                actorId: f.id,
                type: "Link",
                href: i.link,
                canReply: false,
                canReact: false,
                canShare: true,
                title: i.title,
                createdAt: i.pubDate,
                body: i.content,
                image: preview.images[0] || undefined,
                actor: {
                  id: f.id,
                  profile: {
                    name: rss.title,
                    icon: rss.image.link,
                    description: rss.description,
                  },
                },
              };
            })
          );
          break;
      }
    })
  );

  const postOps = cachedPosts.map((post) => ({
    updateOne: {
      filter: { id: post.id },
      update: { $set: post },
      upsert: true,
    },
  }));

  const feedOps = userFeed.map((item) => ({
    updateOne: {
      filter: { actorId, postId: item.postId },
      update: { $set: item },
      upsert: true,
    },
  }));

  try {
    await CachedPosts.bulkWrite(postOps);
  } catch (e) {
    console.log(e);
  }
  try {
    await UserFeed.bulkWrite(feedOps);
  } catch (e) {
    console.log(e);
  }

  user.feedRefreshedAt = new Date();
  await user.save();

  return await CachedPosts.find({ id: { $in: cachedPosts.map((p) => p.id) } })
    .select("-_id -__v")
    .lean();
}
