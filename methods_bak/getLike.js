import { Like } from "../schema/index.js";

export default async function (
  query,
  options = {
    actor: false,
  }
) {
  if (typeof query === "string") query = { id: query };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  let like = await Like.findOne(query);
  if (like && options.actor === true)
    await like.populate("actor", "-_id username id profile keys.public");
  return like;
}
