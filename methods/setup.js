// This initiates and sets up a server if it's not already set up

import Settings from "../schema/Settings.js";
import { User, Activity, Post } from "../schema/index.js";
import crypto from "crypto";
import getSettings from "./getSettings.js";
import createActivity from "./createActivity.js";

export default async function () {
  console.log("Commencing setup....");
  if ((await Settings.countDocuments()) == 0) {
    // Load the default Kowloon server settings from the config text file...
    console.log("Creating default settings...");
    let defaultSettings = {
      actorId: `@${process.env.KOWLOON_DOMAIN}`,
      profile: {
        name: "My Kowloon Server",
        description: "My brand new Kowloon server",
        location: {
          name: "Kowloon Walled City, Hong Kong",
          type: "Place",
          latitude: "22.332222",
          longitude: "114.190278",
        },
        icon: "/images/icons/server.png",
        urls: [`https://${process.env.KOWLOON_DOMAIN}`],
      },
      domain: process.env.KOWLOON_DOMAIN,
      uploadDir: process.env.KOWLOON_UPLOAD_DIR,
      registrationIsOpen: false,
      maxUploadSize: 100,
      defaultPronouns: {
        subject: "they",
        object: "them",
        possAdj: "their",
        possPro: "theirs",
        reflexive: "themselves",
      },
      blocked: [],
      likeEmojis: [
        {
          name: "React",
          emoji: "👍",
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
      adminEmail: "admin@kowloon.social",
      emailServer: {
        protocol: "smtp",
        host: "localhost",
        username: "test",
        password: "test",
      },
      icon: `https://${process.env.KOWLOON_DOMAIN}/images/icons/server.png`,
    };

    // ... and turn them into Settings in the database
    await Promise.all(
      Object.keys(defaultSettings).map(
        async (s) =>
          await Settings.create({ name: s, value: defaultSettings[s] })
      )
    );
    console.log("Creating server public/private keys...");

    // Create the server's public and private keys and add them to the settings
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048, // Adjust the key length as per your requirements
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    await Settings.create([
      {
        name: "publicKey",
        value: publicKey,
      },
      {
        name: "privateKey",
        value: privateKey,
      },
    ]);

    let settings = await getSettings();
    if ((await User.countDocuments()) == 0) {
      console.log("No users found, creating default admin user...");
      await User.create({
        username: process.env.KOWLOON_ADMIN_USERNAME,
        password: process.env.KOWLOON_ADMIN_PASSWORD,
        email: process.env.KOWLOON_ADMIN_EMAIL,
        profile: {
          name: "Admin User",
          description: "I am the admin of this server.",
          urls: [`https://${settings.domain}`],
          icon: "https://avatar.iran.liara.run/public",
          // location,
        },
        isAdmin: true,
      });

      await createActivity({
        type: "Create",
        actorId: settings.actorId,
        to: settings.actorId,
        replyTo: settings.actorId,
        reactTo: settings.actorId,
        objectType: "Post",
        object: {
          actorId: settings.actorId,
          type: "Article",
          title: `Welcome to ${settings.profile.name}!`,
          source: {
            mediaType: "text/html",
            content: `<p>Welcome to ${settings.profile.name}! This is a social network for people who want to connect with others in a secure and private way. Join us today and experience the power of Kowloon!</p>`,
          },
          to: settings.actorId,
          replyTo: settings.actorId,
          reactTo: settings.actorId,
        },
      });

      console.log(
        `Done! You can login to Kowloon with username '${process.env.KOWLOON_ADMIN_USERNAME}' and password '${process.env.KOWLOON_ADMIN_PASSWORD}'`
      );
    }
  }
}
