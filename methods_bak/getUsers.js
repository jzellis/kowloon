import { User } from "../schema/index.js";

export default async function (query, options) {
  options = {
    page: 1,
    pageSize: 20,
    summary: null,
    id: null,
    ...options,
  };
  let startTime = Date.now();
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  // query.active = true;
  let items = await User.find(query)
    .select("username profile id keys.public -_id")
    .limit(options.pageSize ? options.pageSize : 0)
    .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
    .sort({ createdAt: -1 });

  let totalItems = await User.countDocuments(query);
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    id: `https//${this.settings.domain}${options.id ? "/" + options.id : ""}`,
    summary: `${this.settings.title}${
      options.summary ? " | " + options.summary : ""
    } | Users`,
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
