import { Bookmark } from "../schema/index.js";

export default async function (
  query,
  options = {
    actor: false,
    deleted: false,
  }
) {
  if (typeof query === "string") query = { id: query };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  let bookmark = await Bookmark.findOne(query).lean();
  if (bookmark && options.actor === true)
    await bookmark.populate("actor", "-_id username id profile keys.public");
  return bookmark;
}
