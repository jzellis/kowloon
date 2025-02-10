import Kowloon from "../Kowloon.js";
import generateUsers from "./units/generateUsers.js";
import generatePosts from "./units/generatePosts.js";
import generateReacts from "./units/generateReacts.js";
import generateBookmarks from "./units/generateBookmarks.js";

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
      bio: "I'm the admin",
      urls: ["http://kowloon.social"],

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

await generateUsers(10);
await generatePosts(10);
await generateReacts(10);
await generateBookmarks(10);

process.exit(0);
