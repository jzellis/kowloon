import { Post } from "../schema/index.js";
import getSettings from "./getSettings.js";
const settings = await getSettings();

export default async function (query = { public: true }, options) {
  let startTime = Date.now();
  options = {
    actor: false,
    likes: false,
    replies: false,
    page: 1,
    pageSize: 20,
    deleted: false,
    summary: null,
    id: null,
    ...options,
  };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  let populate = "attachments";
  if (options.actor) populate += " actor";
  if (options.likes) populate += " likes";
  if (options.replies) populate += " replies";

  try {
    let items = await Post.find(query)
      .lean()
      .limit(options.pageSize ? options.pageSize : 0)
      .select(
        "-flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy -_id -__v"
      )
      .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
      .sort({ createdAt: -1 })
      .populate(populate);
    let totalItems = await Post.countDocuments(query);
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      // id: `https//${settings.domain}${options.id ? "/" + options.id : ""}`,
      summary: `${settings.title}${
        options.summary ? " | " + options.summary : ""
      } | Posts`,
      totalItems,
      totalPages: Math.ceil(totalItems / (options.page * options.pageSize)),
      currentPage: parseInt(options.page) || 1,
      firstItem: items[0]?.id || "",
      lastItem: items[items.length - 1]?.id || "",
      count: items.length,
      items,
      queryTime: Date.now() - startTime,
    };
  } catch (e) {
    console.error(e);
    return e;
  }
}
