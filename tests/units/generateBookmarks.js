import { faker } from "@faker-js/faker";
import { Settings, User, Post } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function (numBookmarks) {
  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/inbox`;

  let bookmarks = [];
  let users = await User.find();

  for (let i = 0; i < numBookmarks; i++) {
    let actorId = users[Math.floor(Math.random() * users.length)].id;
    let bookmarkActivity = {
      to: ["@public"],
      actorId: actorId,
      type: "Create",
      objectType: "Bookmark",
      object: {
        to: ["@public"],
        cc: ["@admin@kowloon.social"],
        actorId: actorId,
        title: faker.lorem.sentence(),
        href: faker.internet.url(),
        image: faker.image.url(),
        source: {
          mediaType: "text/html",
          content: `<p>${faker.lorem.paragraphs({ min: 1, max: 3 })}</p>`,
        },
      },
    };
    try {
      let reply = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activity: bookmarkActivity }),
      });
      bookmarks.push(await reply.json());
    } catch (e) {
      console.log(e);
    }
  }
  return bookmarks;
}
