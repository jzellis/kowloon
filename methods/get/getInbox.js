import { Inbox } from "../../schema/index.js";

export default async function (actorId, options) {
  let startTime = Date.now();

  options = {
    read: false,
    page: 1,
    pageSize: 20,
    summary: null,
    id: null,
    ...options,
  };
  let query = { to: actorId };
  if (options.read == true) query.read = true;
  let items = await Inbox.find(query)
    .sort({ createdAt: -1 })
    .limit(options.pageSize ? options.pageSize : 0)
    .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0);

  let totalItems = await Inbox.countDocuments(query);
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    id: `https//${this.settings.domain}${options.id ? "/" + options.id : ""}`,
    summary: `${this.settings.title}${
      options.summary ? " | " + options.summary : ""
    } | Inbox`,
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
