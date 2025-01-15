import { faker } from "@faker-js/faker";
import { Settings, User } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function (numPosts) {
  let activityTemplate = {
    type: "Create",
    actorId: "",
    objectType: "Post",
    to: ["@public"],
    object: {},
  };

  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/api/inbox`;

  let posts = [];
  let postTypes = ["Note", "Article", "Link", "Image"];
  let users = await User.find();

  for (let i = 0; i < numPosts; i++) {
    let postActivity = activityTemplate;
    let actorId = users[Math.floor(Math.random() * users.length)].id;
    postActivity.actorId = actorId;
    let postType = postTypes[Math.floor(Math.random() * postTypes.length)];
    postActivity.object = {
      to: ["@public"],

      type: postType,
      source: {
        content: faker.lorem.sentence(),
        mediaType: "text/html",
      },
    };
    if (postType == "Article")
      postActivity.object.source.content = faker.lorem.paragraphs({
        min: 2,
        max: 5,
      });
    if (postType != "Note") postActivity.object.title = faker.lorem.sentence();
    if (postType == "Link") postActivity.object.href = faker.internet.url();
    if (["Image", "Link"].includes(postType))
      postActivity.object.image = faker.image.url();
    let reply = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activity: postActivity }),
    });
    posts.push(await reply.json());
  }
  return posts;
}
