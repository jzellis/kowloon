import { React } from "../schema/index.js";
import getSettings from "./getSettings.js";
const settings = await getSettings();

export default async function (query = { public: true }, options) {
  let startTime = Date.now();

  options = {
    actor: false,
    page: 1,
    pageSize: 20,
    summary: null,
    id: null,
    ...options,
  };
  if (!query) return new Error("No query provided");
  query.deletedAt = { $eq: null };
  let populate = "";
  if (options.actor) populate += "actor";
  let items = await React.find(query)
    .lean()
    .select("-deletedAt -_id -__v")
    .limit(options.pageSize ? options.pageSize : 0)
    .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
    .sort({ createdAt: -1 })

    .populate(populate);

  let totalItems = await React.count(query);
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    id: `https//${settings.domain}${options.id ? "/" + options.id : ""}`,
    summary: `${settings.title}${
      options.summary ? " | " + options.summary : ""
    } | Reacts`,
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
