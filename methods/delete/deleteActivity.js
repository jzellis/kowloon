import { Activity } from "../../schema/index.js";

export default async function (id) {
  try {
    return await Activity.findOneAndUpdate(
      { id },
      { $set: { object: { type: "Tombstone" }, deletedAt: new Date() } }
    );
  } catch (e) {
    return { error: e };
  }
}
