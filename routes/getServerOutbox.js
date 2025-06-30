import Kowloon from "../Kowloon.js";
import { Post } from "../schema/index.js";

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = { server: req.server };
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = {};

  if (req.query.sort) {
    sort = `-${req.query.sort}`;
  } else {
    sort = `-updatedAt`;
  }

  let query = { to: "@public" };
  if (req.query.since)
    query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
  let items = await Post.find(query)
    .select(
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source -signature"
    )
    .limit(pageSize ? pageSize : 0)
    .skip(pageSize ? pageSize * (page - 1) : 0)
    .sort(sort)
    .lean();
  let totalItems = await Post.countDocuments(query);

  response = {
    server: req.server,
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    summary: `${Kowloon.settings.profile.name} | Public Posts | page ${page}`,
    totalItems,
    totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
    items,
    url: `${req.protocol}://${req.hostname}${req.originalUrl}`,
    timestamp: Date.now(),
  };

  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
