import { Group } from "../schema/index.js";

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
  let group = await Group.findOne(query);

  if (group && options.actor === true)
    await group.populate("actor", "-_id username id profile keys.public");
  return group;
}
