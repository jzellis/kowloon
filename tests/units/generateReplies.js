import { faker } from "@faker-js/faker";
import { Settings, User, Post } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function (numPosts) {
  let activityTemplate = {
    type: "Create",
    actorId: "",
    objectType: "Reply",
    to: ["@public"],
    object: {},
  };

  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/inbox`;

  let posts = await Post.find().select("id");
  let users = await User.find();
  let replies = [];

  for (let i = 0; i < numPosts; i++) {
    let tpost = posts[Math.floor(Math.random() * posts.length)];
    let actorId = users[Math.floor(Math.random() * users.length)].id;
    let target = tpost.id;
    let replyActivity = {
      to: ["@public"],
      actorId,
      target,
      type: "Create",
      objectType: "Reply",
      object: {
        to: ["@public"],
        actorId,
        target,
        source: faker.lorem.sentence({
          min: 1,
          max: 3,
        }),
        mediaType: "text/html",
      },
    };

    let reply = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activity: replyActivity }),
    });
    replies.push(await reply.json());
  }
  return replies;
}
