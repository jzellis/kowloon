import Kowloon from "../Kowloon.js";
import { faker } from "@faker-js/faker";
import { Group, User, Circle, Post, Page } from "../schema/index.js";
let scriptStartTime = Date.now();
const coinToss = () => Math.random() < 0.5;

await Kowloon.__nukeDb();
await User.deleteMany({ id: { $ne: "@admin@kowloon.social" } });

const getRandomItems = (arr, x) => {
  const result = arr.slice(); // copy the array
  let i = result.length;
  let temp, j;

  while (i-- > result.length - x) {
    j = Math.floor(Math.random() * (i + 1));
    temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result.slice(result.length - x);
};

const postTypes = ["Note", "Article", "Link", "Media"];

let numPosts = 1000;
let numGroups = 100;
let numCircles = 100;
let numUsers = 100;
let numEvents = 100;
let numPages = 50;

let posts = [];
let circles = [];
let groups = [];
let users = [];
let events = [];
let pages = [];

let startTime = Date.now();
for (let i = 0; i < numUsers; i++) {
  let gender = faker.person.sex();

  let name = faker.person.fullName({ gender });
  let username = name.replace(" ", "").toLowerCase().substring(0, 32);
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
          name: `${faker.location.city()}, ${faker.location.country()}`, //faker.location.city(),
          latitude: faker.location.latitude(),
          longitude: faker.location.longitude(),
        },
        pronouns: {
          subject: gender === "male" ? "he" : "she",
          possAdj: gender === "male" ? "his" : "her",
          possPro: gender === "male" ? "his" : "hers",
          object: gender === "male" ? "him" : "her",
          reflexive: gender === "male" ? "himself" : "herself",
        },
      },
      to: "@public",
      replyTo: "@public",
      reactTo: "@public",
    },
  });
  process.stdout.write(`\rCreating users... ${i + 1} of ${numUsers}`);
}
process.stdout.write(`Created ${numUsers} in ${Date.now() - startTime}ms\n`);

users = await User.find().lean();

startTime = Date.now();
for (let i = 0; i < numGroups; i++) {
  let actorId = users[Math.floor(Math.random() * users.length)].id;
  try {
    await Kowloon.createActivity({
      actorId,
      type: "Create",
      objectType: "Group",
      to: "@public",
      replyTo: "@public",
      reactTo: "@public",
      object: {
        actorId,
        type: "Group",
        name: faker.company.name(),
        description: faker.lorem.sentences({ min: 2, max: 5 }),
        icon: faker.image.avatar(),
        urls: [faker.internet.url()],
        location: {
          type: "Point",
          name: faker.location.city(),
          latitude: faker.location.latitude(),
          longitude: faker.location.longitude(),
        },
        to: "@public",
        replyTo: "@public",
        reactTo: "@public",
        to: "@public",
        replyTo: "@public",
        reactTo: "@public",
      },
    });
  } catch (e) {
    console.log(e);
  }
  process.stdout.write(`\rCreating groups... ${i + 1} of ${numGroups}`);
}
process.stdout.write(`Created ${numGroups} in ${Date.now() - startTime}ms\n`);

groups = await Group.find().lean();

startTime = Date.now();
for (let i = 0; i < numCircles; i++) {
  let actorId = users[Math.floor(Math.random() * users.length)].id;
  let members = getRandomItems(users, Math.floor(Math.random() * 10)).map(
    (i) => {
      return {
        id: i.id,
        serverId: Kowloon.settings.actorId,
        name: i.profile.name,
        inbox: i.inbox,
        outbox: i.outbox,
        icon: i.profile.icon,
        url: i.url,
      };
    }
  );
  await Kowloon.createActivity({
    actorId: Kowloon.settings.actorId,
    type: "Create",
    objectType: "Circle",
    to: "@public",
    replyTo: "@public",
    reactTo: "@public",
    object: {
      actorId,
      type: "Circle",
      name: faker.company.name(),
      description: faker.lorem.sentences({ min: 2, max: 5 }),
      icon: faker.image.avatar(),
      to: "@public",
      replyTo: "@public",
      reactTo: "@public",
      members,
    },
  });
  process.stdout.write(`\rCreating circles... ${i + 1} of ${numCircles}`);
}
process.stdout.write(`Created ${numCircles} in ${Date.now() - startTime}ms\n`);

circles = await Circle.find().lean();

startTime = Date.now();
for (let i = 0; i < numPosts; i++) {
  let actorId = users[Math.floor(Math.random() * users.length)].id;

  let post = {
    actorId,
    to: "@public",
    replyTo: "@public",
    reactTo: "@public",
    objectType: "Post",
    type: postTypes[Math.floor(Math.random() * postTypes.length)],
    source: {
      mediaType: "text/html",
      content: `<p>${faker.lorem.sentences({ min: 2, max: 5 })}</p>`,
    },
  };

  if (Math.random() < 0.2) {
    let group = groups[Math.floor(Math.random() * groups.length)].id;
    post.to = group;
    post.replyTo = group;
    post.reactTo = group;
  }

  if (post.type != "Note") {
    post.title = faker.lorem.sentence();
    post.source.content = `<p>${faker.lorem.paragraphs(
      {
        min: 2,
        max: 5,
      },
      "</p><p>"
    )}</p>`;
  }
  if (post.type == "Link") post.href = faker.internet.url();
  if (["Media", "Link"].includes(post.type)) post.image = faker.image.url();
  if (post.type === "Article" && coinToss()) post.image = faker.image.url();
  if (post.type === "Media") {
    let url = faker.image.url();
    post.attachments = [];
    for (let p = 0; p < Math.floor(Math.random() * 8) + 2; p++) {
      post.attachments.push({
        title: faker.lorem.sentence(),
        description: faker.lorem.sentences({ min: 1, max: 5 }),
        url: url,
        mimeType: "image/jpeg",
        size: 100000,
      });
    }
  }
  await Kowloon.createActivity({
    actorId,
    type: "Create",
    objectType: "Post",
    to: post.to,
    replyTo: post.to,
    reactTo: post.to,
    object: post,
  });
  process.stdout.write(`\rCreating posts... ${i + 1} of ${numPosts}`);
}
process.stdout.write(`Created ${numPosts} in ${Date.now() - startTime}ms\n`);

posts = await Post.find().lean();

startTime = Date.now();

for (let i = 0; i < numPages / 2; i++) {
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
  process.stdout.write(`\rCreating pages... ${i + 1} of ${numPages}`);
  if (activity.error) console.log("Error: ", activity.error);
}

pages = await Page.find().lean();

for (let i = 0; i < numPages / 2; i++) {
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
  process.stdout.write(`\rCreating pages... ${i + 1} of ${numPages}`);
  if (activity.error) console.log("Error: ", activity.error);
}
process.stdout.write(`Created ${numPages} in ${Date.now() - startTime}ms\n`);

let adminCircleMembers = getRandomItems(
  users,
  Math.floor(Math.random() * 10)
).map((i) => {
  return {
    id: i.id,
    serverId: Kowloon.settings.actorId,
    name: i.profile.name,
    inbox: i.inbox,
    outbox: i.outbox,
    icon: i.profile.icon,
    url: i.url,
  };
});

let adminUser = await User.findOne({ id: "@admin@kowloon.social" });
let adminFollowingCircle = await Circle.findOne({ id: adminUser.following });
adminFollowingCircle.members = [
  ...adminFollowingCircle.members,
  ...adminCircleMembers,
];
adminFollowingCircle.memberCount = adminFollowingCircle.members.length;
await adminFollowingCircle.save();

console.log(`Done in ${(Date.now() - scriptStartTime) / 1000} seconds`);
process.exit(0);
