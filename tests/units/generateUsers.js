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
    let username = fullName.replace(" ", "").toLowerCase();
    userActivity.object = {
      username: username,
      password: faker.internet.password(),
      email: faker.internet.email(),
      profile: {
        name: fullName,
        bio: faker.lorem.sentence(),
        urls: [faker.internet.url()],
        icon: faker.image.avatar(),
        location: {
          type: "Point",
          name: faker.location.city(),
          latitude: faker.location.latitude(),
          longitude: faker.location.longitude(),
        },
      },
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
