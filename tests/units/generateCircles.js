import { faker } from "@faker-js/faker";
import { Settings, User, Post } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function (numPosts) {
  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/inbox`;

  let circles = [];
  let users = await User.find({});

  for (let i = 0; i < numPosts; i++) {
    let gusers = await users.sort(() => 0.5 > Math.random());
    gusers = gusers.slice(0, 5);
    gusers = gusers.map((i) => i.id);
    let actorId = users[Math.floor(Math.random() * users.length)].id;
    let circleActivity = {
      to: ["@public"],
      actorId,
      type: "Create",
      objectType: "Circle",
      object: {
        name: faker.lorem.sentence(),
        to: ["@public"],
        actorId,
        summary: faker.lorem.sentence({
          min: 1,
          max: 3,
        }),
        icon: faker.image.avatar(),
        members: gusers,
      },
    };

    let circle = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activity: circleActivity }),
    });
    circles.push(await circle.json());
  }
  return circles;
}
