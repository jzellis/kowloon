import { faker } from "@faker-js/faker";
import { Settings, User, Post } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function (numPosts) {
  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/inbox`;

  let groups = [];
  let users = await User.find({});

  for (let i = 0; i < numPosts; i++) {
    let gusers = await users.sort(() => 0.5 > Math.random());
    gusers = gusers.slice(0, 5);
    // gusers = gusers.map((i) => i.id);
    let actorId = users[Math.floor(Math.random() * users.length)].id;
    let groupActivity = {
      to: ["@public"],
      actorId,
      type: "Create",
      objectType: "Group",
      object: {
        name: faker.lorem.sentence(),
        to: ["@public"],
        actorId,
        summary: faker.lorem.sentence({
          min: 1,
          max: 3,
        }),
        icon: faker.image.avatar(),
        members: gusers.map((u) => {
          return {
            id: u.id,
            name: u.profile.name,
            icon: u.profile.icon,
            inbox: u.inbox,
            outbox: u.outbox,
          };
        }),
      },
    };

    let group = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activity: groupActivity }),
    });
    groups.push(await group.json());
  }
  return groups;
}
