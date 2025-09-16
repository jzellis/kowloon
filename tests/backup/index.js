import Kowloon from "../../Kowloon.js";
import { User } from "../../schema/index.js";
// import faker from "@faker-js/faker";

let postActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kwln.org",
  to: "@public",
  replyTo: Kowloon.settings.actorId,
  reactTo: Kowloon.settings.actorId,
  objectType: "Post",
  object: {
    actorId: "@admin@kwln.org",
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
  actorId: "@admin@kwln.org",
  to: "@public",
  replyTo: Kowloon.settings.actorId,
  reactTo: Kowloon.settings.actorId,
  objectType: "Page",
  object: {
    actorId: "@admin@kwln.org",
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
  actorId: "@admin@kwln.org",
  to: "@public",
  replyTo: Kowloon.settings.actorId,
  reactTo: Kowloon.settings.actorId,
  objectType: "Page",
  object: {
    parentFolder: pageActivity.objectId,
    actorId: "@admin@kwln.org",
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
  actorId: "@admin@kwln.org",
  to: "@public",
  replyTo: Kowloon.settings.actorId,
  reactTo: Kowloon.settings.actorId,
  objectType: "Event",
  object: {
    actorId: "@admin@kwln.org",
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
  actorId: "@admin@kwln.org",
  to: postActivity.to,
  replyTo: postActivity.replyTo,
  reactTo: postActivity.reactTo,
  objectType: "Reply",
  target: postActivity.object.id,
  object: {
    target: postActivity.object.id,
    targetActorId: postActivity.object.actorId,
    actorId: "@admin@kwln.org",
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
  actorId: "@admin@kwln.org",
  to: postActivity.to,
  replyTo: postActivity.replyTo,
  reactTo: postActivity.reactTo,
  objectType: "React",
  target: postActivity.object.id,
  object: {
    target: postActivity.object.id,
    targetActorId: postActivity.object.actorId,
    actorId: "@admin@kwln.org",
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
  actorId: "@admin@kwln.org",
  target: "@bob@kwln.org",
  to: "@public",
  replyTo: "@admin@kwln.org",
  reactTo: "@admin@kwln.org",
});

let blockedReplyActivity = await Kowloon.createActivity({
  type: "Reply",
  actorId: "@bob@kwln.org",
  to: replyActivity.to,
  replyTo: replyActivity.replyTo,
  reactTo: replyActivity.reactTo,
  objectType: "Reply",
  target: replyActivity.object.id,
  object: {
    target: replyActivity.object.id,
    targetActorId: replyActivity.actorId,
    actorId: "@bob@kwln.org",
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
  actorId: "@admin@kwln.org",
  target: "@bob@kwln.org",
  to: "@public",
  replyTo: "@admin@kwln.org",
  reactTo: "@admin@kwln.org",
});

let createCircleActivity = await Kowloon.createActivity({
  type: "Create",
  objectType: "Circle",
  actorId: "@admin@kwln.org",
  to: "@public",
  replyTo: "@admin@kwln.org",
  reactTo: "@admin@kwln.org",
  object: {
    actorId: "@admin@kwln.org",
    name: "Admin's Friends",
    description: "All my homies",
    to: "@public",
    replyTo: "@admin@kwln.org",
    reactTo: "@admin@kwln.org",
  },
});

let followActivity = await Kowloon.createActivity({
  type: "Follow",
  actorId: "@admin@kwln.org",
  object: "@bob@kwln.org",
  target: createCircleActivity.object.id,
  to: "@public",
  replyTo: "@admin@kwln.org",
  reactTo: "@admin@kwln.org",
});

let admin = await User.findOne({ id: "@admin@kwln.org" });

let unfollowActivity = await Kowloon.createActivity({
  type: "Unfollow",
  actorId: "@admin@kwln.org",
  target: createCircleActivity.object.id,
  object: "@bob@kwln.org",
  to: "@public",
  replyTo: "@admin@kwln.org",
  reactTo: "@admin@kwln.org",
});

let deleteActivity = await Kowloon.createActivity({
  type: "Delete",
  actorId: "@admin@kwln.org",
  target: createCircleActivity.object.id,
  to: "@public",
  replyTo: "@admin@kwln.org",
  reactTo: "@admin@kwln.org",
});

let updateActivity = await Kowloon.createActivity({
  type: "Update",
  actorId: "@admin@kwln.org",
  target: postActivity.object.id,
  to: "@public",
  replyTo: "@admin@kwln.org",
  reactTo: "@admin@kwln.org",
  object: {
    source: {
      content: "<p>This content has been updated, yo.</p>",
    },
  },
});

let createGroupActivity = await Kowloon.createActivity({
  type: "Create",
  objectType: "Group",
  actorId: "@admin@kwln.org",
  object: {
    actorId: "@admin@kwln.org",

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
  actorId: "@bob@kwln.org",
  target: createGroupActivity.object.id,
  to: "@bob@kwln.org",
  replyTo: "@bob@kwln.org",
  reactTo: "@bob@kwln.org",
});

let inviteGroupActivity = await Kowloon.createActivity({
  type: "Invite",
  actorId: "@admin@kwln.org",
  target: createGroupActivity.object.id,
  object: "@bob@kwln.org",
  to: "@public",
  replyTo: "@admin@kwln.org",
  reactTo: "@admin@kwln.org",
});

let rejectGroupActivity = await Kowloon.createActivity({
  type: "Reject",
  actorId: "@bob@kwln.org",
  target: createGroupActivity.object.id,
  to: "@public",
  replyTo: "@admin@kwln.org",
  reactTo: "@admin@kwln.org",
});

let createGroupPostActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kwln.org",
  to: createGroupActivity.object.id,
  replyTo: createGroupActivity.object.id,
  reactTo: createGroupActivity.object.id,
  objectType: "Post",
  object: {
    actorId: "@admin@kwln.org",
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
  actorId: "@admin@kwln.org",
  to: "@public",
  replyTo: "@public",
  reactTo: "@public",
  objectType: "Bookmark",
  object: {
    actorId: "@admin@kwln.org",
    type: "Folder",
    title: "Search Engines",
    to: "@public",
    replyTo: "@public",
    reactTo: "@public",
  },
});

let createBookmarkActivity = await Kowloon.createActivity({
  type: "Create",
  actorId: "@admin@kwln.org",
  to: "@public",
  replyTo: "@public",
  reactTo: "@public",
  objectType: "Bookmark",
  object: {
    actorId: "@admin@kwln.org",
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
  actorId: "@admin@kwln.org",
  to: createGroupActivity.object.id,
  replyTo: createGroupActivity.object.id,
  reactTo: createGroupActivity.object.id,
  objectType: "Bookmark",
  object: {
    actorId: "@admin@kwln.org",
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
