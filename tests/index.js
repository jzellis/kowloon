import Kowloon from "../Kowloon.js";
import generateUsers from "./units/generateUsers.js";
import generatePosts from "./units/generatePosts.js";
import generateLikes from "./units/generateLikes.js";
import util from "util";

await Kowloon.__nukeDb();

let adminUser = {
  type: "Create",
  objectType: "User",
  object: {
    username: "admin",
    password: "admin",
    email: "admin@kowloon.social",
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
await generateLikes(10);

process.exit(0);
