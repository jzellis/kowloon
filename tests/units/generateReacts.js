import { faker } from "@faker-js/faker";
import { Settings, User, Post } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function (numReacts) {
  let activityTemplate = {
    type: "React",
    objectType: "React",
    actorId: "",
    target: "",
    object: {},
  };

  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/inbox`;

  let likeTypes = (await Settings.findOne({ name: "likeEmojis" })).value;
  let likes = [];
  let posts = await Post.find().select("id").lean();
  let users = await User.find();

  for (let i = 0; i < numReacts; i++) {
    let actorId = users[Math.floor(Math.random() * users.length)].id;
    let target = posts[Math.floor(Math.random() * posts.length)].id;
    let emojiType = likeTypes[Math.floor(Math.random() * likeTypes.length)];
    let likeActivity = {
      to: ["@public"],
      actorId: actorId,
      target: target,
      type: "React",
      object: {
        emoji: emojiType.emoji,
        name: emojiType.name,
        to: ["@public"],
        actorId: actorId,
        target: target,
      },
    };
    let reply = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activity: likeActivity }),
    });
    likes.push(await reply.json());
  }
  return likes;
}
