import { User } from "../../schema/index.js";

export default async function (
  query,
  options = {
    page: 1,
    pageSize: 20,
  }
) {
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  // query.active = true;
  let users = await User.find(query)
    .select("username profile id keys.public -_id")
    .limit(options.pageSize ? options.pageSize : 0)
    .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
    .sort({ createdAt: -1 });
  return users;
}
