// This method retrieves a user whether local or remote. Does not return deleted items.

import get from "./get.js";
import { User } from "../schema/index.js";
export default async function (id) {
  let user;
  user = await User.findOne({ id, deletedAt: null }).select(
    "username profile prefs publicKey"
  );
  if (!user) {
    let [username, server] = id.split("@").slice(1);
    let req = await get(`https://${server}/users/${id}`);
    user = req.user || null;
  }
  return user;
}
