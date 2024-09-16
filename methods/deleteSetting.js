import { Settings } from "../schema/index.js";

export default async function (id) {
  try {
    return await Settings.findOneAndUpdate(
      { id },
      { $set: { deletedAt: new Date() } }
    );
  } catch (e) {
    return { error: e };
  }
}
