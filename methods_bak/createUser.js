import { User } from "../schema/index.js";

export default async function (user) {
  return await User.create(user);
}
