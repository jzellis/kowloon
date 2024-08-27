import { Group } from "../../schema/index.js";

export default async function (id) {
  try {
    return await Group.findOneAndUpdate(
      { id },
      { $set: { deletedAt: new Date() } }
    );
  } catch (e) {
    return { error: e };
  }
}
