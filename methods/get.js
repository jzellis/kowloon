import { User } from "../schema/index.js";
import { Agent, setGlobalDispatcher } from "undici";

const agent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

setGlobalDispatcher(agent);

export default async function (url, actorId) {
  let user;
  let headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (actorId) {
    user = await User.findOne({ id: actorId });
    if (user) {
      headers["Authorization"] = `Basic ${user.publicKey.replaceAll(
        "\n",
        "\\r\\n"
      )}`;
      headers["kowloon-id"] = user.id;
    }
  }
  try {
    let res = await fetch(url, {
      method: "GET",
      headers,
    });

    return res.headers.get("content-type").indexOf("json") !== -1
      ? await res.json()
      : await res.text();
  } catch (e) {
    return new Error(e);
  }
}
