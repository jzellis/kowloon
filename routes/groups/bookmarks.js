import Kowloon from "../../Kowloon.js";
import { Bookmark } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = {};
  if (req.query.sort) {
    sort[req.query.sort] = -1;
  } else {
    sort.updatedAt = -1;
  }
  let query = {
    ...(await Kowloon.generateQuery(req.user?.id)),
    type: "Bookmark",
    to: req.params.id,
  };
  if (req.query.type) query.type = req.query.type.split(",");
  if (req.query.since)
    query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
  let items = await Bookmark.find(query)
    .select(
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
    )
    .limit(pageSize ? pageSize : 0)
    .skip(pageSize ? pageSize * (page - 1) : 0)
    .sort({ sort: -1 });
  let totalItems = await Bookmark.countDocuments(query);

  response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    // id: `https//${settings.domain}${id ? "/" + id : ""}`,
    summary: `${Kowloon.settings.profile.name} | Bookmarks`,
    totalItems,
    totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
    currentPage: parseInt(page) || 1,
    firstItem: pageSize * (page - 1) + 1,
    lastItem: pageSize * (page - 1) + items.length,
    count: items.length,
    items,
  };
  // response.files = await Bookmark.find(query);
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
