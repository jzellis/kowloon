import { faker } from "@faker-js/faker";
import { Settings, User, Post } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function (numReacts) {
  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/api/inbox`;

  let bookmarks = [];
  let posts = await Post.find().select("id").lean();
  let users = await User.find();

  for (let i = 0; i < numReacts; i++) {
    let actorId = users[Math.floor(Math.random() * users.length)].id;
    let target = posts[Math.floor(Math.random() * posts.length)].id;
    let bookmarkActivity = {
      to: ["@public"],
      actorId: actorId,
      target: target,
      type: "Create",
      objectType: "Bookmark",
      object: {
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
      body: JSON.stringify({ activity: bookmarkActivity }),
    });
    bookmarks.push(await reply.json());
  }
  return bookmarks;
}
