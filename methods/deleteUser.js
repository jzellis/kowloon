import { User } from "../schema/index.js";

export default async function (id) {
  try {
    return await User.findOneAndUpdate(
      { id },
      { $set: { active: false, deletedAt: new Date() } }
    );
  } catch (e) {
    return { error: e };
  }
}
