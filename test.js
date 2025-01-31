import {
  Activity,
  Post,
  Circle,
  Group,
  User,
  React,
  Bookmark,
} from "./schema/index.js";
import { faker } from "@faker-js/faker";
import Kowloon from "./Kowloon.js";
import commandLineArgs from "command-line-args";

const toTitleCase = (str) =>
  str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );

const optionDefinitions = [
  { name: "createUsers", type: Boolean, defaultValue: true },
  { name: "verbose", alias: "v", type: Boolean, defaultValue: false },

  { name: "users", alias: "u", type: Number, defaultValue: 100 },
  //   { name: "activities", alias: "a", type: Number, defaultValue: 10 },
  { name: "posts", alias: "p", type: Number, defaultValue: 100 },
  { name: "circles", alias: "c", type: Number, defaultValue: 100 },
  { name: "groups", alias: "g", type: Number, defaultValue: 100 },
  { name: "bookmarks", alias: "b", type: Number, defaultValue: 100 },
  { name: "likes", alias: "l", type: Number, defaultValue: 100 },
];
const options = commandLineArgs(optionDefinitions);

let startTime = new Date();
let delActivities = await Activity.deleteMany({});
let delUsers = options.createUsers === true ? await User.deleteMany({}) : {};
let delPosts = await Post.deleteMany({});
let delCircles = await Circle.deleteMany({});
let delGroups = await Group.deleteMany({});
let delBookmarks = await Bookmark.deleteMany({});
let delReacts = await React.deleteMany({});

if (options.verbose === true) {
  console.log("Deleting Activities: ", delActivities);
  if (options.createUsers === true) console.log("Deleting Users: ", delUsers);
  console.log("Deleting Posts: ", delPosts);
  console.log("Deleting Circles: ", delCircles);
  console.log("Deleting Groups: ", delGroups);
  console.log("Deleting Bookmarks: ", delBookmarks);
  console.log("Deleting Reacts: ", delReacts);
}

if (options.createUsers === true) {
  for (let i = 0; i < options.users; i++) {
    let uStart = new Date();
    let user = {
      username: faker.internet.userName(),
      password: "123456",
      email: faker.internet.email(),

      profile: {
        name: faker.person.fullName(),
        bio: faker.lorem.sentence(),
        urls: [faker.internet.url()],
        location: {
          name: faker.location.city(),
          type: "Place",
          latitude: faker.location.latitude(),
          longitude: faker.location.longitude(),
        },
      },
    };

    try {
      let nuser = await User.create(user);
      let uEnd = new Date();
      if (options.verbose === true)
        console.log(`Created user: ${nuser.id} (${uEnd - uStart}ms)`);
    } catch (e) {
      console.log(new Error(e));
    }
  }
}

await User.create({
  username: "admin",
  password: "admin",
  email: "admin@kowloon.social",

  profile: {
    name: "Administrator",
    bio: "The administrator of this server",
    urls: ["https://kowloon.social"],
    location: {
      name: "Kowloon",
      type: "Place",
      latitude: 22.332222,
      longitude: 114.190278,
    },
  },
});

let allUsers = await User.find({});

for (let i = 0; i < options.circles; i++) {
  let uStart = new Date();
  let cMembers = faker.helpers.arrayElements(allUsers);

  cMembers = cMembers.map((u) => u.id);
  let circle = {
    actorId: faker.helpers.arrayElement(allUsers).id,
    name: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    icon: faker.image.url(),
    public: faker.datatype.boolean(),
    members: cMembers,
  };
  try {
    let ncircle = await Circle.create(circle);
    let uEnd = new Date();
    console.log(`Created circle: ${ncircle.id} (${uEnd - uStart}ms)`);
  } catch (e) {
    console.log(new Error(e));
  }
}

for (let i = 0; i < options.groups; i++) {
  let gStart = new Date();
  let gMembers = faker.helpers.arrayElements(allUsers);
  gMembers = gMembers.map((u) => u.id);
  let group = {
    actorId: faker.helpers.arrayElement(allUsers).id,
    name: faker.lorem.sentence(),
    icon: faker.image.url(),

    description: faker.lorem.paragraph(),
    public: faker.datatype.boolean(),
    members: gMembers,
  };
  try {
    let ngroup = await Group.create(group);
    let gEnd = new Date();
    if (options.verbose === true)
      console.log(`Created group: ${ngroup.id} (${gEnd - gStart}ms)`);
  } catch (e) {
    console.log(new Error(e));
  }
}

let postTypes = ["Note", "Article", "Audio", "Video", "Image", "Link"];
for (let i = 0; i < options.posts; i++) {
  let pStart = new Date();
  let user = faker.helpers.arrayElement(allUsers);
  let uGroups = (
    await Group.find({
      $or: [{ actorId: user.id }, { members: user.id }],
    })
  ).map((u) => u.id);

  let uCircles = (await Circle.find({ actorId: user.id })).map((u) => u.id);
  let activity = {
    actorId: user.id,
    type: "Create",
    objectType: "Post",
    object: {
      type: faker.helpers.arrayElement(postTypes),
      source: {
        mediaType: "text/html",
        content: faker.lorem.paragraph(),
      },
      public: faker.datatype.boolean(),
    },
  };

  if (activity.object.type != "Note")
    activity.object.title = faker.lorem.sentence();
  if (activity.object.type == "Link")
    activity.object.link = faker.internet.url();
  if (activity.object.type == "Image")
    activity.object.attachments = [
      { title: faker.lorem.sentence(), url: faker.internet.url() },
    ];

  if (faker.datatype.boolean() && uGroups.length > 0)
    activity.object.groups = [faker.helpers.arrayElement(uGroups)];

  if (
    !activity.object.groups &&
    faker.datatype.boolean() &&
    uCircles.length > 0
  )
    activity.object.circles = faker.helpers.arrayElement(uCircles);

  try {
    let nactivity = await Activity.create(activity);
    let pEnd = new Date();
    if (options.verbose === true)
      console.log(`Created post: ${nactivity.objectId} (${pEnd - pStart}ms)`);
  } catch (e) {
    console.log(new Error(e));
  }
}

let allPosts = (await Post.find({})).map((p) => p.id);

for (let i = 0; i < options.bookmarks; i++) {
  let bStart = new Date();
  let user = faker.helpers.arrayElement(allUsers);

  let activity = {
    actorId: user.id,
    type: "Bookmark",
    public: faker.datatype.boolean(),
    object: {
      href: faker.internet.url(),
      tags: faker.lorem.words().split(" "),
      title: toTitleCase(faker.lorem.sentence()),
      summary: faker.lorem.sentence(),
      image: faker.internet.url(),
    },
  };
  let nbookmark = await Activity.create(activity);
  let bEnd = new Date();
  if (options.verbose === true)
    console.log(`Created bookmark: ${nbookmark.objectId} (${bEnd - bStart}ms)`);
}

let allActivities = (await Activity.find({})).map((a) => a.id);
let likeableIds = allActivities.concat(allPosts);

for (let i = 0; i < options.likes; i++) {
  let lStart = new Date();
  let user = faker.helpers.arrayElement(allUsers);
  let activity = {
    actorId: user.id,
    type: "React",
    public: faker.datatype.boolean(),
    object: {
      target: faker.helpers.arrayElement(likeableIds),
      type: faker.helpers.arrayElement(Kowloon.settings.likeEmojis),
    },
  };
  let nlike = await Activity.create(activity);
  let lEnd = new Date();
  if (options.verbose === true)
    console.log(`Created like: ${nlike.objectId} (${lEnd - lStart}ms)`);
}

let endTime = new Date();
console.log(`Total time: ${(endTime - startTime) * 0.001}s`);
process.exit(0);
