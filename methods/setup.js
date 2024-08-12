import Settings from "../schema/Settings.js";
import User from "../schema/User.js";
import crypto from "crypto";

const defaultSettings = {
  title: "Kowloon.social",
  description: "The very first Kowloon server ever!",
  location: {
    name: "Kowloon, Hong Kong",
    type: "Place",
    latitude: 22.332222,
    longitude: 114.190278,
  },
  domain: "kowloon.social",
  asDomain: "kowloon.social",
  uploadDir: "./uploads",
  registrationIsOpen: false,
  defaultPronouns: {
    subject: "they",
    object: "them",
    possAdj: "their",
    possPro: "theirs",
    reflexive: "themselves",
  },
  blockedDomains: [],
  likeEmojis: [
    { name: "Like", emoji: "👍" },
    { name: "Love", emoji: "❤️" },
    { name: "Sad", emoji: "😭" },
    { name: "Angry", emoji: "🤬" },
    { name: "Shocked", emoji: "😮" },
    { name: "Puke", emoji: "🤮" },
  ],
  adminEmail: "admin@kowloon.social",
  icon: "https://kowloon.social/icons/server.png",
};

export default async function () {
  console.log("Commencing setup....");
  let settings = await Settings.find();
  if (settings.length === 0) {
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
