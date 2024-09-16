import { User } from "../schema/index.js";

export default async function (id, user) {
  try {
    return await User.findOneAndUpdate({ id }, { $set: user });
  } catch (e) {
    return { error: e };
  }
}
