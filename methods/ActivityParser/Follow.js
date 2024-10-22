import { User, Circle } from "../../schema/index.js";
import Parser from "rss-parser";
export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  let followed = await fetch(activity.target, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  follow.contentType = followTarget.headers.get("content-type");
  switch (follow.contentType.indexOf("kowloon") !== -1) {
    case true:
      let body = await followTarget.json();
      follow.type = "kowloon";
      follow.feedType = body.isServer ? "server" : "user";
      if (body.user) {
        follow.name = body.user.profile.name;
        follow.username = body.user.username;
        follow.icon = body.user.profile.icon;
        follow.publicKey = body.user.keys.public;
      } else {
        return { error: "Not found" };
      }
      break;
    case false:
      let parser = new Parser();
      let feed = await parser.parseURL(url);
      follow.type = "rss";
      follow.name = feed.title;
      follow.icon = feed.image?.url;
      break;
  }
  follow.followedAt = new Date();
  user.following.push(follow);
  await user.save();
  await Circle.updateOne(
    { actorId: user.id, name: `${user.username} - Following` },
    { $push: { members: follow.id } }
  );
  return activity;
}
