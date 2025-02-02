import { User } from "../schema/index.js";

export default async function (
  query,
  options = {
    full: false,
    deleted: false,
  }
) {
  if (typeof query === "string")
    query = { $or: [{ id: query }, { username: query }] };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");

  let select = options.full
    ? "-_id"
    : "-_id id url username profile keys.public";
  let user = await User.findOne(query).lean().select(select);
  return user;
}
