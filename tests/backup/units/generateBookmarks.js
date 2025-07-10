import { faker } from "@faker-js/faker";
import { Settings, User, Post } from "../../../schema/index.js";
import Kowloon from "../../../Kowloon.js";
export default async function (numBookmarks) {
  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/inbox`;

  let folders = [];
  let bookmarks = [];
  let users = await User.find();

  // Generate folders

  for (let i = 0; i < 10; i++) {
    let actorId = "@admin@kowloon.social";
    let bookmarkActivity = {
      to: ["@public"],
      actorId: actorId,
      type: "Create",
      objectType: "Bookmark",
      object: {
        type: "Folder",
        to: ["@public"],
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
      folders.push(await reply.json());
    } catch (e) {
      console.log(e);
    }
  }

  folders = folders.map((f) => f.activity.objectId);
  console.log("Folders: ", folders);
  //Generate bookmarks

  for (let i = 0; i < numBookmarks; i++) {
    let actorId = users[Math.floor(Math.random() * users.length)].id;
    let bookmarkActivity = {
      to: ["@public"],
      actorId: actorId,
      type: "Create",
      objectType: "Bookmark",
      object: {
        type: "Bookmark",
        to: ["@public"],
        cc: ["@admin@kowloon.social"],
        actorId: actorId,
        title: faker.lorem.sentence(),
        href: faker.internet.url(),
        image: faker.image.url(),
        parent:
          Math.random() > 0.5
            ? folders[Math.floor(Math.random() * folders.length)]
            : undefined,

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
