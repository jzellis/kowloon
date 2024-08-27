import Kowloon from "../../Kowloon.js";
import { Activity } from "../../schema/index.js";

export default async function (
  query,
  options = {
    actor: false,
    likes: false,
    deleted: false,
  }
) {
  if (typeof query === "string") query = { id: query };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  let activity = await Activity.findOne(query);
  if (activity && options.actor === true)
    await activity.populate("actor", "-_id username id profile keys.public");
  if (activity && options.likes === true)
    await activity.populate("likes", "-_id id actorId type");

  return activity;
}
