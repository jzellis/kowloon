import get from "../methods/remote/get.js";
import post from "../methods/remote/post.js";
import { faker } from "@faker-js/faker";

let baseUrl = "https://kowloon.social";
let res;

const postActivity = {
  type: "Create",
  objectType: "Post",
  object: {
    type: "Note",
    source: {
      mediaType: "text/html",
      content: faker.lorem.paragraph(),
    },
    public: faker.datatype.boolean(),
    publicReplies: faker.datatype.boolean(),
  },
};

const circleActivity = {
  type: "Create",
  objectType: "Circle",
  object: {
    name: faker.name.jobTitle(),
    description: faker.lorem.paragraph(),
    public: faker.datatype.boolean(),
    members: ["@admin@kowloon.social"],
    summary: "This is my generated circle",
    public: faker.datatype.boolean(),
  },
};

const groupActivity = {
  type: "Create",
  objectType: "Group",
  object: {
    name: faker.name.jobTitle(),
    description: faker.lorem.paragraph(),
    public: faker.datatype.boolean(),
    members: ["@admin@kowloon.social"],
    summary: "This is my generated group",
    public: faker.datatype.boolean(),
    location: {
      type: "Place",
      name: faker.location.city(),
      latitude: faker.location.latitude({ precision: 6 }),
      longitude: faker.location.longitude({ precision: 6 }),
    },
  },
};

let loginBody = {
  username: "admin",
  password: "admin",
};

let key = await (
  await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(loginBody),
  })
).text();

let headers = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: "Basic " + key,
};

try {
  let postedActivity = await (
    await fetch(`${baseUrl}/inbox`, {
      method: "POST",
      headers,
      body: JSON.stringify({ activity: postActivity }),
    })
  ).json();
  console.log(
    "Post Activity and new post id: \n  ",
    postedActivity.activity.id + "\n  ",
    postedActivity.activity.objectId
  );

  // Create a Circle
  let postedCircleActivity = await (
    await fetch(`${baseUrl}/inbox`, {
      method: "POST",
      headers,
      body: JSON.stringify({ activity: circleActivity }),
    })
  ).json();
  console.log(
    "Circle Activity and new circle id: \n  ",
    postedCircleActivity.activity.id + "\n  ",
    postedCircleActivity.activity.objectId
  );

  let postedGroupActivity = await (
    await fetch(`${baseUrl}/inbox`, {
      method: "POST",
      headers,
      body: JSON.stringify({ activity: groupActivity }),
    })
  ).json();
  console.log(
    "Group Activity and new group id: \n  ",
    postedGroupActivity.activity.id + "\n  ",
    postedGroupActivity.activity.objectId
  );
} catch (e) {
  console.log(e);
}
process.exit(0);
