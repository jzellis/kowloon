import { Reply } from "../schema/index.js";
import getSettings from "./getSettings.js";
const settings = await getSettings();

export default async function (query = { to: "@public" }, options) {
  options = {
    actor: false,
    page: 1,
    pageSize: 20,
    deleted: false,
    id: null,
    ...options,
  };
  if (!query) return new Error("No query provided");
  if (options.deleted === false) query.deletedAt = { $eq: null };
  let populate = "";
  if (options.actor) populate += "actor";
  let items = await Reply.find(query)
    .select(
      "-flaggedAt -flaggedBy -flaggedReason -bcc -rbcc -object.bcc -object.rbcc -deletedAt -deletedBy -_id -__v"
    )
    .limit(options.pageSize ? options.pageSize : 0)
    .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
    .sort({ createdAt: -1 })
    .populate("actor", "-_id username id profile keys.public");

  let totalItems = await Reply.countDocuments(query);

  return {
    "@context": "https://www.w3.org/ns/replystreams",
    type: "OrderedCollection",
    // id: `https//${settings.domain}${options.id ? "/" + options.id : ""}`,
    summary: `${settings.title}${
      options.summary ? " | " + options.summary : ""
    } | Replies`,
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
