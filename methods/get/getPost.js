import { Post } from "../../schema/index.js";

export default async function (
  query,
  options = {
    actor: false,
    replies: false,
    deleted: false,
  }
) {
  if (typeof query === "string") query = { id: query };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  let post = await Post.findOne(query);
  if (post && options.actor === true)
    await post.populate("actor", "-_id username id profile keys.public");
  if (post && options.replies === true) await post.populate("replies", "-_id");
  return post;
}
