import Kowloon from "../../Kowloon.js";
import { Feed } from "../../schema/index.js";
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
  if (!req.user?.id || !req.user?.id.endsWith(Kowloon.settings.actorId)) {
    response = { error: "You are not authorized to view this inbox" };
  } else {
    let query = {
      to: {
        $in: ["@public"],
      },
    };
    if (req.query.type) query.type = req.query.type;

    if (req.query.since)
      query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
    let items = await Feed.find(query)
      .select(
        "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
      )
      .limit(pageSize ? pageSize : 0)
      .skip(pageSize ? pageSize * (page - 1) : 0)
      .sort({ sort: -1 })
      .populate("actor", "-_id username id profile publicKey");
    let totalItems = await Feed.countDocuments(query);

    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      // id: `https//${settings.domain}${id ? "/" + id : ""}`,
      summary: `${Kowloon.settings.profile.name} | Feeds`,
      totalItems,
      totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
      currentPage: parseInt(page) || 1,
      firstItem: pageSize * (page - 1) + 1,
      lastItem: pageSize * (page - 1) + items.length,
      count: items.length,
      items,
    };
    response.query = query;
  }
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
