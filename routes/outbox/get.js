import Kowloon from "../../Kowloon.js";
import generateQuery from "../../methods/generateQuery.js";
import { Post } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = req.query.sort ? `-${req.query.sort}` : "-updatedAt";
  let query = req.user
    ? await generateQuery(req.user)
    : {
        to: "@public",
      };
  if (req.query.type) query.type = req.query.type.split(",");

  if (req.query.since)
    query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
  let items = await Post.find(query)
    .select(
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
    )
    .limit(pageSize ? pageSize : 0)
    .skip(pageSize ? pageSize * (page - 1) : 0)
    .sort(sort);
  let totalItems = await Post.countDocuments(query);

  response = {
    server: req.server,
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    // id: `https//${settings.domain}${id ? "/" + id : ""}`,
    summary: `${Kowloon.settings.profile.name} | Public Feed`,
    totalItems,
    totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
    currentPage: parseInt(page) || 1,
    firstItem: pageSize * (page - 1) + 1,
    lastItem: pageSize * (page - 1) + items.length,
    count: items.length,
    items,
  };
  // response.activities = await Feed.find(query);
  response.query = query;
  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
  // res.status(status).json(req.user);
}
