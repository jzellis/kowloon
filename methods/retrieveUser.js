import { User } from "../schema/index.js";
import get from "./get.js";

export default async function (id) {
  let user = await User.findOne({ id });
  if (!user) {
    let [username, domain] = id.split("@").slice(1);
    let url = `https://${domain}/users/${username}`;
    try {
      user = (await get(url)).user;
    } catch (e) {
      console.error(e);
    }
  }
  return user;
}
