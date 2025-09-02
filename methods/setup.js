// This initiates and sets up a server if it's not already set up

import { User, Settings } from "../schema/index.js";
import * as dotenv from "dotenv";

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const initFile = "setup.tmp";
const initDir = path.dirname(initFile);
dotenv.config();
console.log("Process.env: ", process.env.DOMAIN);

const domain = process.env.DOMAIN;
const siteTitle = process.env.SITE_TITLE;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

export default async function () {
  try {
    let defaultSettings = {
      actorId: `@${domain}`,
      profile: {
        name: siteTitle,
        subtitle: "My brand new Kowloon server",
        description:
          "<p>This is a new Kowloon server that I've set up. It's going to be a great place for me and my community to share ideas with each other and the world!</p>",
        location: {
          name: "Kowloon Walled City, Hong Kong",
          type: "Place",
          latitude: "22.332222",
          longitude: "114.190278",
        },
        icon: "/images/icons/server.png",
        urls: [`https://${process.env.KOWLOON_DOMAIN}`],
      },
      domain: domain,
      registrationIsOpen: false,
      maxUploadSize: 100,
      defaultPronouns: {
        subject: "they",
        object: "them",
        possAdj: "their",
        possPro: "theirs",
        reflexive: "themselves",
      },
      blocked: {},
      likeEmojis: [
        {
          name: "Like",
          emoji: "👍",
        },
        {
          name: "Laugh",
          emoji: "😂",
        },

        {
          name: "Love",
          emoji: "❤️",
        },
        {
          name: "Sad",
          emoji: "😭",
        },
        {
          name: "Angry",
          emoji: "🤬",
        },
        {
          name: "Shocked",
          emoji: "😮",
        },
        {
          name: "Puke",
          emoji: "🤮",
        },
      ],
      adminEmail: adminEmail,
      emailServer: {
        protocol: "smtp",
        host: "localhost",
        username: "test",
        password: "test",
      },
      createdAt: new Date(Date.now()),
      updatedAt: new Date(Date.now()),
    };

    await Promise.all(
      Object.keys(defaultSettings).map(
        async (s) =>
          await Settings.create({ name: s, value: defaultSettings[s] })
      )
    );

    await User.create({
      username: "admin",
      password: adminPassword,
      email: adminEmail,
      profile: {
        name: "Admin",
        subtitle: "The human, the myth, the legend",
        description: "I am the admin of this server.",
        urls: [`https://${domain}`],
        icon: "",
        location: {
          name: "Kowloon Walled City, Hong Kong",
          type: "Place",
          latitude: "22.332222",
          longitude: "114.190278",
        },
      },
      to: "@public",
      isAdmin: true,
    });

    console.log("Setup temp file deleted.");
  } catch (e) {
    console.error(e);
    process.exit(0);
  }
  try {
    await fs.rm(initFile, { force: true });
    console.log("Setup temp file deleted.");
  } catch (e) {
    console.error(e);
  }
}
