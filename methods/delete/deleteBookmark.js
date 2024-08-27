import { Bookmark } from "../../schema/index.js";

export default async function (id) {
  try {
    return await Bookmark.findOneAndUpdate(
      { id },
      { $set: { deletedAt: new Date() } }
    );
  } catch (e) {
    return { error: e };
  }
}
