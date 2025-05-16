import Kowloon from "../../Kowloon.js";
import { Circle } from "../../schema/index.js";
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
  let query = req.user?.id
    ? { to: { $in: ["@public", Kowloon.settings.actorId] } }
    : { to: "@public" };
  query.actorId = Kowloon.settings.actorId;
  query.members = { $ne: [] };
  if (req.query.type) query.type = req.query.type.split(",");
  if (req.query.since)
    query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
  console.log("Circle query: ", query);
  let items = await Circle.find(query)
    .select("-deletedAt -deletedBy -_id -__v -source -members")
    .limit(pageSize ? pageSize : 0)
    .skip(pageSize ? pageSize * (page - 1) : 0)
    .sort({ sort: -1 });
  let totalItems = await Circle.countDocuments(query);

  response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    // id: `https//${settings.domain}${id ? "/" + id : ""}`,
    summary: `${Kowloon.settings.profile.name} | Circles`,
    totalItems,
    totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
    currentPage: parseInt(page) || 1,
    firstItem: pageSize * (page - 1) + 1,
    lastItem: pageSize * (page - 1) + items.length,
    count: items.length,
    items,
  };
  // response.circles = await Circle.find(query);
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
