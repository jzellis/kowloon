// Fixed populate.js for Kowloon with proper user creation and improved visibility
import Kowloon from "../Kowloon.js";
import { faker } from "@faker-js/faker";
import { Group, User, Circle, Post, Page } from "../schema/index.js";

const coinToss = () => Math.random() < 0.5;
const getRandomItems = (arr, x) =>
  arr.sort(() => 0.5 - Math.random()).slice(0, x);
const scriptStartTime = Date.now();

await Kowloon.__nukeDb();
await User.deleteMany({ id: { $ne: "@admin@kowloon.social" } });

const NUM_USERS = 100;
const NUM_GROUPS = 30;
const NUM_CIRCLES = 30;
const NUM_POSTS = 100;
const NUM_PAGES = 50;
const NUM_REPLIES = 5;
const NUM_REACTS = 5;

let users = [],
  groups = [],
  circles = [],
  posts = [],
  pages = [];

console.log("Creating users...");
for (let i = 0; i < NUM_USERS; i++) {
  const gender = faker.person.sex();
  const name = faker.person.fullName({ gender });
  const username = name.replace(/\s+/g, "").toLowerCase().substring(0, 32);

  await Kowloon.createActivity({
    actorId: Kowloon.settings.actorId,
    type: "Create",
    objectType: "User",
    to: "@public",
    replyTo: "@public",
    reactTo: "@public",
    object: {
      type: "Person",
      username,
      email: faker.internet.email(),
      password: "12345678",
      profile: {
        name,
        subtitle: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        urls: [faker.internet.url()],
        icon: `https://avatar.iran.liara.run/public/${
          gender === "male" ? "boy" : "girl"
        }`,
        location: {
          type: "Point",
          name: `${faker.location.city()}, ${faker.location.country()}`,
          latitude: faker.location.latitude(),
          longitude: faker.location.longitude(),
        },
        pronouns: {
          subject: gender === "male" ? "he" : "she",
          object: gender === "male" ? "him" : "her",
          possAdj: gender === "male" ? "his" : "her",
          possPro: gender === "male" ? "his" : "hers",
          reflexive: gender === "male" ? "himself" : "herself",
        },
      },
    },
  });
  process.stdout.write(`\rCreated ${i + 1} of ${NUM_USERS} users`);
}
users = await User.find().lean();
console.log(`\nCreated ${users.length} users.`);

console.log("Creating groups...");
for (let i = 0; i < NUM_GROUPS; i++) {
  const creator = faker.helpers.arrayElement(users);
  await Kowloon.createActivity({
    actorId: creator.id,
    type: "Create",
    objectType: "Group",
    to: "@public",
    object: {
      actorId: creator.id,
      type: "Group",
      name: faker.company.name(),
      description: faker.lorem.sentences(3),
      icon: faker.image.avatar(),
      urls: [faker.internet.url()],
      location: {
        type: "Point",
        name: faker.location.city(),
        latitude: faker.location.latitude(),
        longitude: faker.location.longitude(),
      },
    },
  });
  process.stdout.write(`\rCreated ${i + 1} of ${NUM_GROUPS} groups`);
}
groups = await Group.find().lean();
console.log(`\nCreated ${groups.length} groups.`);

console.log("Creating circles...");
for (let i = 0; i < NUM_CIRCLES; i++) {
  const creator = faker.helpers.arrayElement(users);
  const members = getRandomItems(
    users,
    faker.number.int({ min: 3, max: 10 })
  ).map((u) => ({
    id: u.id,
    serverId: Kowloon.settings.actorId,
    name: u.profile.name,
    inbox: u.inbox,
    outbox: u.outbox,
    icon: u.profile.icon,
    url: u.url,
  }));

  await Kowloon.createActivity({
    actorId: creator.id,
    type: "Create",
    objectType: "Circle",
    to: "@public",
    object: {
      actorId: creator.id,
      type: "Circle",
      name: faker.company.name(),
      description: faker.lorem.sentences(2),
      icon: faker.image.avatar(),
      members,
    },
  });
  process.stdout.write(`\rCreated ${i + 1} of ${NUM_CIRCLES} circles`);
}
circles = await Circle.find().lean();
console.log(`\nCreated ${circles.length} circles.`);

console.log("Creating posts with diverse visibility...");
for (let i = 0; i < NUM_POSTS; i++) {
  const actor = faker.helpers.arrayElement(users);
  const type = faker.helpers.arrayElement(["Note", "Article", "Link", "Media"]);

  let to = "@public";
  const roll = Math.random();
  if (roll < 0.3) {
    const userGroups = groups.filter((g) => g.actorId === actor.id);
    if (userGroups.length) to = faker.helpers.arrayElement(userGroups).id;
  } else if (roll < 0.6) {
    const userCircles = circles.filter((c) => c.actorId === actor.id);
    if (userCircles.length) to = faker.helpers.arrayElement(userCircles).id;
  }

  const post = {
    actorId: actor.id,
    type,
    to,
    replyTo: to,
    reactTo: to,
    source: {
      mediaType: "text/html",
      content: `<p>${faker.lorem.paragraphs(2, "</p><p>")}</p>`,
    },
  };

  if (type !== "Note") post.title = faker.lorem.sentence();
  if (type === "Link") post.href = faker.internet.url();
  if (["Media", "Link"].includes(type)) post.image = faker.image.url();
  if (type === "Media") {
    post.attachments = Array.from(
      { length: faker.number.int({ min: 2, max: 5 }) },
      () => ({
        title: faker.lorem.sentence(),
        description: faker.lorem.sentences(2),
        url: faker.image.url(),
        mimeType: "image/jpeg",
        size: 100000,
      })
    );
  }

  await Kowloon.createActivity({
    actorId: actor.id,
    type: "Create",
    objectType: "Post",
    to,
    replyTo: to,
    reactTo: to,
    object: post,
  });
  process.stdout.write(`\rCreated ${i + 1} of ${NUM_POSTS} posts`);
}

for (let i = 0; i < NUM_PAGES / 2; i++) {
  let activity = await Kowloon.createActivity({
    actorId: "@admin@kowloon.social",
    type: "Create",
    objectType: coinToss() ? "Folder" : "Page",
    to: "@public",
    replyTo: "@public",
    reactTo: "@public",
    object: {
      actorId: "@admin@kowloon.social",
      to: "@public",
      replyTo: "@public",
      reactTo: "@public",
      title: faker.music.album(),
      image: faker.image.url(),
      source: {
        mediaType: "text/html",
        content: `<p>${faker.lorem.paragraphs(
          { min: 5, max: 10 },
          "</p><p>"
        )}</p>`,
      },
    },
  });
  process.stdout.write(`\rCreating pages... ${i + 1} of ${NUM_PAGES}`);
  if (activity.error) console.log("Error: ", activity.error);
}

pages = await Page.find().lean();

for (let i = 0; i < NUM_PAGES / 2; i++) {
  let activity = await Kowloon.createActivity({
    actorId: "@admin@kowloon.social",
    type: "Create",
    objectType: "Page",
    to: "@public",
    replyTo: "@public",
    reactTo: "@public",
    object: {
      actorId: "@admin@kowloon.social",
      to: "@public",
      replyTo: "@public",
      reactTo: "@public",
      parentFolder: pages[Math.floor(Math.random() * pages.length)].id,

      title: faker.music.album(),
      image: faker.image.url(),

      source: {
        mediaType: "text/html",
        content: `<p>${faker.lorem.paragraphs(
          { min: 5, max: 10 },
          "</p><p>"
        )}</p>`,
      },
    },
  });
  process.stdout.write(`\rCreating pages... ${i + 1} of ${NUM_PAGES}`);
  if (activity.error) console.log("Error: ", activity.error);
}
process.stdout.write(`Created ${NUM_PAGES}\n`);

console.log("\n✅ Sample data populated.");
process.exit(0);
