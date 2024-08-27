import { Bookmark } from "../../schema/index.js";

export default async function (
  query = { public: true },
  options = {
    actor: false,
    page: 1,
    pageSize: 20,
  }
) {
  if (!query) return new Error("No query provided");
  query.deletedAt = { $eq: null };
  let populate = "";
  if (options.actor) populate += "actor";
  let bookmarks = await Bookmark.find(query)
    .select("-deletedAt -_id -__v")
    .limit(options.pageSize ? options.pageSize : 0)
    .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
    .sort({ createdAt: -1 })

    .populate(populate);
  return bookmarks;
}
