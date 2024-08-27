import { Post } from "../../schema/index.js";

export default async function (
  query = { public: true },
  options = {
    actor: false,
    likes: false,
    page: 1,
    pageSize: 20,
    deleted: false,
  }
) {
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  let populate = "";
  if (options.actor) populate += "actor";
  if (options.likes) populate += " likes";
  try {
    let posts = await Post.find(query)
      .limit(options.pageSize ? options.pageSize : 0)
      .select("-flagged -deletedAt -deletedBy -_id -__v")
      .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
      .sort({ createdAt: -1 })
      .populate(populate);

    return posts;
  } catch (e) {
    console.error(e);
    return e;
  }
}
