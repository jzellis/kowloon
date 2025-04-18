import Kowloon from "../../Kowloon.js";
import { Post } from "../../schema/index.js";
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
    sort.createdAt = -1;
  }
  let query = {
    actorId: req.params.id,
    to: {
      $in: ["@public", req.user?.id, req.server?.id].concat(
        req.user?.memberships,
        req.server?.memberships
      ),
    },
  };
  if (req.user?.id && req.user.id.split("@").pop() === Kowloon.settings.domain)
    query.to.$in.push("@server");
  if (req.query.type) query.type = req.query.type;
  if (req.user) query.from = { $nin: req.user.blocked.concat(req.user.muted) };
  if (req.query.since)
    query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
  let items = await Post.find(query)
    .select(
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source -signature"
    )
    .limit(pageSize ? pageSize : 0)
    .skip(pageSize ? pageSize * (page - 1) : 0)
    .sort(sort)
    .populate("actor", "-_id username id profile publicKey");
  let totalItems = await Post.countDocuments(query);

  response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    // id: `https//${settings.domain}${id ? "/" + id : ""}`,
    summary: `${Kowloon.settings.title} | Posts`,
    totalItems,
    totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
    currentPage: parseInt(page) || 1,
    firstItem: pageSize * (page - 1) + 1,
    lastItem: pageSize * (page - 1) + items.length,
    count: items.length,
    items,
  };
  // response.activities = await Post.find(query);
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
