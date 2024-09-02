import Settings from "../schema/Settings.js";
import User from "../schema/User.js";
import crypto from "crypto";
import fs from "fs/promises";

export default async function () {
  console.log("Commencing setup....");
  let settings = await Settings.find();
  if (settings.length === 0) {
    let defaultSettings = JSON.parse(
      await fs.readFile("../config/defaultSettings.json", "utf8")
    );
    await Promise.all(
      Object.keys(defaultSettings).map(
        async (s) =>
          await Settings.create({ name: s, value: defaultSettings[s] })
      )
    );
  }

  let users = await User.find();
  if (users.length === 0) {
    await User.create({
      username: "admin",
      password: "admin",
      email: "admin@kowloon.social",
      profile: {
        name: "Admin User",
        bio: "I am the admin of this server.",
        urls: ["https://kowloon.social"],
        location: {
          name: "Kowloon, Hong Kong",
          type: "Place",
          latitude: 22.332222,
          longitude: 114.190278,
        },
      },
      isAdmin: true,
    });
  }
}
