import { User } from "../schema/index.js";
import sanitize from "./sanitize.js";

export default async function (user) {
  return await User.create(user);
}
