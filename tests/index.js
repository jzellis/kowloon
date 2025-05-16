import Kowloon from "../Kowloon.js";
import { User } from "../schema/index.js";
// import faker from "@faker-js/faker";

let postActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kowloon.social",
  to: "@public",
  replyTo: Kowloon.settings.actorId,
  reactTo: Kowloon.settings.actorId,
  objectType: "Post",
  object: {
    actorId: "@admin@kowloon.social",
    type: "Article",
    title: `Welcome to ${Kowloon.settings.profile.name}!`,
    source: {
      mediaType: "text/html",
      content: `<p>Welcome to ${Kowloon.settings.profile.name}! This is a social network for people who want to connect with others in a secure and private way. Join us today and experience the power of Kowloon!</p>`,
    },
    to: "@public",
    replyTo: Kowloon.settings.actorId,
    reactTo: Kowloon.settings.actorId,
  },
});
let pageActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kowloon.social",
  to: "@public",
  replyTo: Kowloon.settings.actorId,
  reactTo: Kowloon.settings.actorId,
  objectType: "Page",
  object: {
    actorId: "@admin@kowloon.social",
    type: "Page",
    title: `About ${Kowloon.settings.profile.name}!`,
    source: {
      mediaType: "text/html",
      content: `<p>This is the about page for this community.</p>`,
    },
    to: "@public",
    replyTo: Kowloon.settings.actorId,
    reactTo: Kowloon.settings.actorId,
  },
});

let subpageActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kowloon.social",
  to: "@public",
  replyTo: Kowloon.settings.actorId,
  reactTo: Kowloon.settings.actorId,
  objectType: "Page",
  object: {
    parentFolder: pageActivity.objectId,
    actorId: "@admin@kowloon.social",
    type: "Page",
    title: `Subpage For About Page For ${Kowloon.settings.profile.name}!`,
    source: {
      mediaType: "text/html",
      content: `<p>This is the about page for this community.</p>`,
    },
    to: "@public",
    replyTo: Kowloon.settings.actorId,
    reactTo: Kowloon.settings.actorId,
  },
});

let eventActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kowloon.social",
  to: "@public",
  replyTo: Kowloon.settings.actorId,
  reactTo: Kowloon.settings.actorId,
  objectType: "Event",
  object: {
    actorId: "@admin@kowloon.social",
    type: "Event",
    title: `${Kowloon.settings.profile.name} Launch Party!`,
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
    location: {
      type: "Place",
      latitude: "22.332222",
      longitude: "114.166666",
      name: "Kowloon",
    },
    source: {
      mediaType: "text/html",
      content: `<p>This is a launch party for this community.</p>`,
    },
    to: "@public",
    replyTo: Kowloon.settings.actorId,
    reactTo: Kowloon.settings.actorId,
  },
});

console.log(eventActivity);

let replyActivity = await Kowloon.createActivity({
  type: "Reply",
  actorId: "@admin@kowloon.social",
  to: postActivity.to,
  replyTo: postActivity.replyTo,
  reactTo: postActivity.reactTo,
  objectType: "Reply",
  target: postActivity.object.id,
  object: {
    target: postActivity.object.id,
    targetActorId: postActivity.object.actorId,
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

let react =
  Kowloon.settings.likeEmojis[
    Math.floor(Math.random() * Kowloon.settings.likeEmojis.length)
  ];

let reactActivity = await Kowloon.createActivity({
  type: "React",
  actorId: "@admin@kowloon.social",
  to: postActivity.to,
  replyTo: postActivity.replyTo,
  reactTo: postActivity.reactTo,
  objectType: "React",
  target: postActivity.object.id,
  object: {
    target: postActivity.object.id,
    targetActorId: postActivity.object.actorId,
    actorId: "@admin@kowloon.social",
    emoji: react.emoji,
    name: react.name,
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

let blockActivity = await Kowloon.createActivity({
  type: "Block",
  actorId: "@admin@kowloon.social",
  target: "@bob@kowloon.social",
  to: "@public",
  replyTo: "@admin@kowloon.social",
  reactTo: "@admin@kowloon.social",
});

let blockedReplyActivity = await Kowloon.createActivity({
  type: "Reply",
  actorId: "@bob@kowloon.social",
  to: replyActivity.to,
  replyTo: replyActivity.replyTo,
  reactTo: replyActivity.reactTo,
  objectType: "Reply",
  target: replyActivity.object.id,
  object: {
    target: replyActivity.object.id,
    targetActorId: replyActivity.actorId,
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

let unBlockActivity = await Kowloon.createActivity({
  type: "Unblock",
  actorId: "@admin@kowloon.social",
  target: "@bob@kowloon.social",
  to: "@public",
  replyTo: "@admin@kowloon.social",
  reactTo: "@admin@kowloon.social",
});

let createCircleActivity = await Kowloon.createActivity({
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

let followActivity = await Kowloon.createActivity({
  type: "Follow",
  actorId: "@admin@kowloon.social",
  object: "@bob@kowloon.social",
  target: createCircleActivity.object.id,
  to: "@public",
  replyTo: "@admin@kowloon.social",
  reactTo: "@admin@kowloon.social",
});

let admin = await User.findOne({ id: "@admin@kowloon.social" });

let unfollowActivity = await Kowloon.createActivity({
  type: "Unfollow",
  actorId: "@admin@kowloon.social",
  target: createCircleActivity.object.id,
  object: "@bob@kowloon.social",
  to: "@public",
  replyTo: "@admin@kowloon.social",
  reactTo: "@admin@kowloon.social",
});

let deleteActivity = await Kowloon.createActivity({
  type: "Delete",
  actorId: "@admin@kowloon.social",
  target: createCircleActivity.object.id,
  to: "@public",
  replyTo: "@admin@kowloon.social",
  reactTo: "@admin@kowloon.social",
});

let updateActivity = await Kowloon.createActivity({
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

let createGroupActivity = await Kowloon.createActivity({
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

let joinGroupActivity = await Kowloon.createActivity({
  type: "Join",
  actorId: "@bob@kowloon.social",
  target: createGroupActivity.object.id,
  to: "@bob@kowloon.social",
  replyTo: "@bob@kowloon.social",
  reactTo: "@bob@kowloon.social",
});

let inviteGroupActivity = await Kowloon.createActivity({
  type: "Invite",
  actorId: "@admin@kowloon.social",
  target: createGroupActivity.object.id,
  object: "@bob@kowloon.social",
  to: "@public",
  replyTo: "@admin@kowloon.social",
  reactTo: "@admin@kowloon.social",
});

let rejectGroupActivity = await Kowloon.createActivity({
  type: "Reject",
  actorId: "@bob@kowloon.social",
  target: createGroupActivity.object.id,
  to: "@public",
  replyTo: "@admin@kowloon.social",
  reactTo: "@admin@kowloon.social",
});

let createGroupPostActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kowloon.social",
  to: createGroupActivity.object.id,
  replyTo: createGroupActivity.object.id,
  reactTo: createGroupActivity.object.id,
  objectType: "Post",
  object: {
    actorId: "@admin@kowloon.social",
    type: "Note",
    source: {
      mediaType: "text/html",
      content: `<p>This is the first post for my new group!</p>`,
    },
    to: createGroupActivity.object.id,
    replyTo: createGroupActivity.object.id,
    reactTo: createGroupActivity.object.id,
  },
});

let createBookmarkFolderActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kowloon.social",
  to: "@public",
  replyTo: "@public",
  reactTo: "@public",
  objectType: "Bookmark",
  object: {
    actorId: "@admin@kowloon.social",
    type: "Folder",
    title: "Search Engines",
    to: "@public",
    replyTo: "@public",
    reactTo: "@public",
  },
});

let createBookmarkActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kowloon.social",
  to: "@public",
  replyTo: "@public",
  reactTo: "@public",
  objectType: "Bookmark",
  object: {
    actorId: "@admin@kowloon.social",
    type: "Bookmark",
    title: "Google",
    parentFolder: createBookmarkFolderActivity.objectId,
    href: "https://www.google.com",
    to: "@public",
    replyTo: "@public",
    reactTo: "@public",
  },
});

let createGroupBookmarkActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kowloon.social",
  to: createGroupActivity.object.id,
  replyTo: createGroupActivity.object.id,
  reactTo: createGroupActivity.object.id,
  objectType: "Bookmark",
  object: {
    actorId: "@admin@kowloon.social",
    type: "Bookmark",
    title: "Google",
    parentFolder: createBookmarkFolderActivity.objectId,
    href: "https://www.google.com",
    to: createGroupActivity.object.id,
    replyTo: createGroupActivity.object.id,
    reactTo: createGroupActivity.object.id,
  },
});

process.exit(0);
