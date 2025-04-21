import { Feed } from "../schema/index.js";
import getSettings from "./getSettings.js";
const settings = await getSettings();

export default async function (query = { to: "@public" }, options) {
  options = {
    actorId: "@public",
    page: 1,
    pageSize: 20,
    deleted: false,
    id: null,
    ...options,
  };

  if (!query) return new Error("No query provided");
  if (options.deleted === false) query.deletedAt = { $eq: null };
  let items = await Feed.find(query)
    .select("-_id -__v")
    .limit(options.pageSize ? options.pageSize : 0)
    .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
    .sort({ createdAt: -1 })
    .lean();

  items.forEach((item, idx) => {
    let recipients = Array.from(new Set([...item.to]));
    item.isPublic = recipients.includes("@public");
    item.serverOnly = recipients.includes("@server");
    item.canReply =
      item.rto.includes(options.actorId) || item.rto.includes("@public");
    item.to = [options.actorId];
    item.rto = undefined;
  });

  let totalItems = await Feed.countDocuments(query);

  return {
    "@context": "https://www.w3.org/ns/feedstreams",
    type: "OrderedCollection",
    // id: `https//${settings.domain}${options.id ? "/" + options.id : ""}`,
    summary: `${settings.profile.name}${
      options.summary ? " | " + options.summary : ""
    } | Feeds`,
    totalItems,
    totalPages: Math.ceil(
      totalItems / (options.page * options.pageSize ? options.pageSize : 20)
    ),
    currentPage: parseInt(options.page) || 1,
    firstItem: options.pageSize * (options.page - 1) + 1,
    lastItem: options.pageSize * (options.page - 1) + items.length,
    count: items.length,
    items,
  };
}
