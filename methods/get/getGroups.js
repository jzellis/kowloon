import { Group } from "../../schema/index.js";

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
  if (!query) return new Error("No query provided");
  if (options.deleted === false) query.deletedAt = { $eq: null };
  let populate = "";
  if (options.actor) populate += "actor";
  if (options.likes) populate += " likes";
  try {
    let groups = await Group.find(query)
      .select("-banned -flagged -deletedAt -deletedBy -_id -__v")
      .limit(options.pageSize ? options.pageSize : 0)
      .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
      .sort({ createdAt: -1 })
      .populate(populate);

    return groups;
  } catch (e) {
    console.error(e);
    return e;
  }
}
