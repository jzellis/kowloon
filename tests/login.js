import get from "../methods/remote/get.js";
import post from "../methods/remote/post.js";

let baseUrl = "https://kowloon.social";

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

try {
  let user = await (
    await fetch(`https://kowloon.social/users/admin`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Basic " + key,
      },
    })
  ).json();

  console.log(user);
} catch (e) {
  console.log(e);
}
process.exit(0);
