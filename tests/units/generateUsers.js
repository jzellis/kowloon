import { faker } from "@faker-js/faker";
import { Settings } from "../../schema/index.js";
import Kowloon from "../../Kowloon.js";
export default async function (numUsers) {
  let activityTemplate = {
    type: "Create",
    objectType: "User",
    object: {},
  };

  let baseUrl = `https://${
    (await Settings.findOne({ name: "domain" })).value
  }/inbox`;
  let users = [];

  for (let i = 0; i < numUsers; i++) {
    let userActivity = activityTemplate;
    let fullName = faker.person.fullName();
    let username = fullName.replace(" ", "").toLowerCase().substring(0, 32);
    userActivity.object = {
      username: username,
      password: "12345678",
      email: `${username}@gmail.com`,
      profile: {
        name: fullName,
        bio: faker.lorem.sentence(),
        urls: [faker.internet.url()],
        icon:
          "https://avatar.iran.liara.run/public?a=" +
          Math.floor(Math.random() * 100),
        location: {
          type: "Point",
          name: faker.location.city(),
          latitude: faker.location.latitude(),
          longitude: faker.location.longitude(),
        },
      },
      to: ["@public"],
    };

    let reply = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activity: userActivity }),
    });
    users.push(await reply.json());
  }
  return users;
}
