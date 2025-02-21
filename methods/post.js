import { User } from "../schema/index.js";
import { Agent, setGlobalDispatcher } from "undici";
const agent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

setGlobalDispatcher(agent);

export default async function (url, options = { actorId: "", body: {} }) {
  if (options.body) return new Error("No body specified");
  let user;
  let headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (options.actorId) {
    user = await User.findOne({ id: actorId });
    if (user) {
      headers["Authorization"] = `Basic ${user.publicKey.replaceAll(
        "\n",
        "\\r\\n"
      )}`;
      headers["kowloon-id"] = user.id;
    }
  }
  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(options.body),
  });

  return res.headers.get("content-type").indexOf("json") !== -1
    ? await res.json()
    : await res.text();
}
