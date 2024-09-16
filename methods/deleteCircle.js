import { Circle } from "../schema/index.js";

export default async function (id) {
  try {
    return await Circle.findOneAndUpdate(
      { id },
      { $set: { deletedAt: new Date() } }
    );
  } catch (e) {
    return { error: e };
  }
}
