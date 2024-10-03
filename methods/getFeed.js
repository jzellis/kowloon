import { Feed } from "../schema/index.js";

export default async function (
  id, // User, group, circle or server id
  options
) {
  options = {
    page: 1,
    pageSize: 20,
    deleted: false,
    ...options,
  };
  let startTime = Date.now();

  if (!id) return new Error("No user or server id provided");
  let query = {
    $or: [{ from: id }, { to: id }, { bto: id }, { cc: id }, { bcc: id }],
  };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  let items = await Feed.find(query)
    .lean()
    .sort({ createdAt: -1 })
    .limit(options.pageSize ? options.pageSize : 0)
    .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
    .select("-_id -item._id -cc -bcc -item.cc -item.bcc");

  let totalItems = await Feed.countDocuments(query);

  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    totalItems,
    totalPages: Math.ceil(
      totalItems / (options.page * options.pageSize ? options.pageSize : 20)
    ),
    currentPage: parseInt(options.page) || 1,
    firstItem: options.pageSize * (options.page - 1) + 1,
    lastItem: options.pageSize * (options.page - 1) + items.length + 1,
    count: items.length,
    items,
    queryTime: Date.now() - startTime,
  };
}
