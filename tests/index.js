import Kowloon from "../Kowloon.js";
import generateUsers from "./units/generateUsers.js";
import generatePosts from "./units/generatePosts.js";
import generateReacts from "./units/generateReacts.js";
import generateBookmarks from "./units/generateBookmarks.js";
import generateReplies from "./units/generateReplies.js";
import generateGroups from "./units/generateGroups.js";
import generateCircles from "./units/generateCircles.js";
import addUsersToCircles from "./units/addUsersToCircles.js";
import getAllCircleMembers from "./units/getAllCircleMembers.js";
import generateGroupPosts from "./units/generateGroupPosts.js";
import { faker } from "@faker-js/faker";
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

await Kowloon.__nukeDb();

let adminUser = {
  type: "Create",
  objectType: "User",
  object: {
    username: "admin",
    password: "admin",
    email: "admin@kowloon.social",
    to: [],
    bcc: ["@admin@kowloon.social"],
    profile: {
      name: "Admin",
      description: "I'm the admin",
      urls: ["http://kowloon.social"],
      icon:
        "https://avatar.iran.liara.run/public?a=" +
        Math.floor(Math.random() * 100),

      location: {
        type: "Point",
        name: "London, UK",
        latitude: 51.5072178,
        longitude: -0.1275862,
      },
    },
  },
};

await Kowloon.createActivity(adminUser);

try {
  await generateUsers(10);
  await generatePosts(10);
  await generateReacts(10);
  // await generateBookmarks(50);
  await generateReplies(10);
  await generateGroups(10);
  await generateGroupPosts(10);
  await generateCircles(10);
  await addUsersToCircles();
} catch (e) {
  console.log(e);
}

process.exit(0);
