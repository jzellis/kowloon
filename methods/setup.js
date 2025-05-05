// This initiates and sets up a server if it's not already set up

import Settings from "../schema/Settings.js";
import { User } from "../schema/index.js";
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
        to: "@public",
        isAdmin: true,
      });

      let postActivity = await createActivity({
        type: "Create",
        actorId: "@admin@kowloon.social",
        to: "@public",
        replyTo: settings.actorId,
        reactTo: settings.actorId,
        objectType: "Post",
        object: {
          actorId: "@admin@kowloon.social",
          type: "Article",
          title: `Welcome to ${settings.profile.name}!`,
          source: {
            mediaType: "text/html",
            content: `<p>Welcome to ${settings.profile.name}! This is a social network for people who want to connect with others in a secure and private way. Join us today and experience the power of Kowloon!</p>`,
          },
          to: "@public",
          replyTo: settings.actorId,
          reactTo: settings.actorId,
        },
      });

      let replyActivity = await createActivity({
        type: "Reply",
        actorId: "@admin@kowloon.social",
        to: postActivity.to,
        replyTo: postActivity.replyTo,
        reactTo: postActivity.reactTo,
        objectType: "Reply",
        target: postActivity.object.id,
        object: {
          target: postActivity.object.id,
          actorId: "@admin@kowloon.social",
          source: {
            mediaType: "text/html",
            content: `<p>This is a reply to the first post</p>`,
          },
          to: postActivity.to,
          replyTo: postActivity.replyTo,
          reactTo: postActivity.reactTo,
        },
      });

      console.log("Reply activity object id: ", replyActivity.object.id);

      let reactActivity = await createActivity({
        type: "React",
        actorId: "@admin@kowloon.social",
        to: postActivity.to,
        replyTo: postActivity.replyTo,
        reactTo: postActivity.reactTo,
        objectType: "React",
        target: postActivity.object.id,
        object: {
          target: postActivity.object.id,
          actorId: "@admin@kowloon.social",
          emoji: "👍",
          name: "React",
          to: postActivity.to,
          replyTo: postActivity.replyTo,
          reactTo: postActivity.reactTo,
        },
      });

      let seconduser = await User.create({
        username: "bob",
        password: "12345",
        email: "bob2gmail.com",
        profile: {
          name: "Bob Smith",
          description: "I am a test user.",
          urls: [`https://bob.com`],
          icon: "https://avatar.iran.liara.run/public",
          // location,
        },
      });

      let blockActivity = await createActivity({
        type: "Block",
        actorId: "@admin@kowloon.social",
        target: "@bob@kowloon.social",
        to: "@public",
        replyTo: "@admin@kowloon.social",
        reactTo: "@admin@kowloon.social",
      });

      let blockedReplyActivity = await createActivity({
        type: "Reply",
        actorId: "@bob@kowloon.social",
        to: replyActivity.to,
        replyTo: replyActivity.replyTo,
        reactTo: replyActivity.reactTo,
        objectType: "Reply",
        target: replyActivity.object.id,
        object: {
          target: replyActivity.object.id,
          actorId: "@bob@kowloon.social",
          source: {
            mediaType: "text/html",
            content: `<p>This is a blocked reply to the first post</p>`,
          },
          to: replyActivity.to,
          replyTo: replyActivity.replyTo,
          reactTo: replyActivity.reactTo,
          parent: replyActivity.object.id,
        },
      });

      let unBlockActivity = await createActivity({
        type: "Unblock",
        actorId: "@admin@kowloon.social",
        target: "@bob@kowloon.social",
        to: "@public",
        replyTo: "@admin@kowloon.social",
        reactTo: "@admin@kowloon.social",
      });

      let createCircleActivity = await createActivity({
        type: "Create",
        objectType: "Circle",
        actorId: "@admin@kowloon.social",
        to: "@public",
        replyTo: "@admin@kowloon.social",
        reactTo: "@admin@kowloon.social",
        object: {
          actorId: "@admin@kowloon.social",
          name: "Admin's Friends",
          description: "All my homies",
          to: "@public",
          replyTo: "@admin@kowloon.social",
          reactTo: "@admin@kowloon.social",
        },
      });

      let followActivity = await createActivity({
        type: "Follow",
        actorId: "@admin@kowloon.social",
        object: "@bob@kowloon.social",
        target: createCircleActivity.object.id,
        to: "@public",
        replyTo: "@admin@kowloon.social",
        reactTo: "@admin@kowloon.social",
      });

      let admin = await User.findOne({ id: "@admin@kowloon.social" });

      let unfollowActivity = await createActivity({
        type: "Unfollow",
        actorId: "@admin@kowloon.social",
        target: createCircleActivity.object.id,
        object: "@bob@kowloon.social",
        to: "@public",
        replyTo: "@admin@kowloon.social",
        reactTo: "@admin@kowloon.social",
      });

      let deleteActivity = await createActivity({
        type: "Delete",
        actorId: "@admin@kowloon.social",
        target: createCircleActivity.object.id,
        to: "@public",
        replyTo: "@admin@kowloon.social",
        reactTo: "@admin@kowloon.social",
      });

      let updateActivity = await createActivity({
        type: "Update",
        actorId: "@admin@kowloon.social",
        target: postActivity.object.id,
        to: "@public",
        replyTo: "@admin@kowloon.social",
        reactTo: "@admin@kowloon.social",
        object: {
          source: {
            content: "<p>This content has been updated, yo.</p>",
          },
        },
      });

      let createGroupActivity = await createActivity({
        type: "Create",
        objectType: "Group",
        actorId: "@admin@kowloon.social",
        object: {
          actorId: "@admin@kowloon.social",

          name: "My First Group",
          description: "This is my very first group",
          private: true,
          to: "@public",
          replyTo: "@public",
          reactTo: "@public",
        },
        to: "@public",
        replyTo: "@public",
        reactTo: "@public",
      });

      // let joinGroupActivity = await createActivity({
      //   type: "Join",
      //   actorId: "@bob@kowloon.social",
      //   target: createGroupActivity.object.id,
      //   to: "@bob@kowloon.social",
      //   replyTo: "@bob@kowloon.social",
      //   reactTo: "@bob@kowloon.social",
      // });

      let inviteGroupActivity = await createActivity({
        type: "Invite",
        actorId: "@admin@kowloon.social",
        target: createGroupActivity.object.id,
        object: "@bob@kowloon.social",
        to: "@public",
        replyTo: "@admin@kowloon.social",
        reactTo: "@admin@kowloon.social",
      });

      let rejectGroupActivity = await createActivity({
        type: "Reject",
        actorId: "@bob@kowloon.social",
        target: createGroupActivity.object.id,
        to: "@public",
        replyTo: "@admin@kowloon.social",
        reactTo: "@admin@kowloon.social",
      });

      console.log(
        `Done! You can login to Kowloon with username '${process.env.KOWLOON_ADMIN_USERNAME}' and password '${process.env.KOWLOON_ADMIN_PASSWORD}'`
      );
    }
  }
}
