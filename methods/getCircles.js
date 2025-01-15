import { Circle } from "../schema/index.js";
import getSettings from "./getSettings.js";
const settings = await getSettings();

export default async function (query, options) {
  let startTime = Date.now();
  options = {
    actor: false,
    likes: false,
    page: 1,
    pageSize: 20,
    deleted: false,
    summary: null,
    id: null,
    ...options,
  };
  if (!query) return new Error("No query provided");
  if (typeof query === "string") query = { id: query };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  let populate = "";
  if (options.actor) populate += "actor";
  if (options.likes) populate += " likes";
  try {
    let items = await Circle.find(query)
      .lean()
      .select("-banned -flagged -deletedAt -deletedBy -_id -__v -bcc")
      .limit(options.pageSize ? options.pageSize : 0)
      .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
      .sort({ createdAt: -1 })
      .populate(populate);
    let totalItems = await Circle.countDocuments(query);
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      id: `https//${settings.domain}${options.id ? "/" + options.id : ""}`,
      summary: `${settings.title}${
        options.summary ? " | " + options.summary : ""
      } | Circles`,
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
  } catch (e) {
    console.error(e);
    return e;
  }
}
