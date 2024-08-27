import { User } from "../schema/index.js";
import sanitize from "./sanitize.js";

export default async function (username, password) {
  let user = await User.findOne({ username: username });

  if (!user) return false;
  if (!(await user.verifyPassword(password))) return false;
  // user.keys.private = undefined;
  // user.password = undefined;
  user.lastLogin = new Date();
  await user.save();
  // return user.accessToken;
  return user.keys.public.replaceAll("\n", "\\r\\n");
}
