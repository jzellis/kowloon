import Kowloon from "../../Kowloon.js";
import { Feed } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.num || 100;
  let sort = {};
  if (req.query.sort) {
    sort[req.query.sort] = -1;
  } else {
    sort.createdAt = -1;
  }
  if (!req.user || req.user?.id != req.params.id) {
    response = { error: "You are not authorized to view this inbox" };
  } else {
    let recipients = ["@public", req.user?.id].concat(
      req.user?.memberships,
      req.server?.memberships
    );
    if (req.server?.id) recipients.push(req.server?.id);
    let query = {
      $or: [{ to: { $in: recipients } }, { "actor.id": req.user?.id }],
    };

    if (req.query.type) query.type = req.query.type;

    if (req.query.since)
      query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
    let items = await Feed.find(query)
      .select(
        "-flaggedAt -flaggedBy -flaggedReason -bcc -rbcc -object.bcc -object.rbcc -deletedAt -deletedBy -_id -__v -source"
      )
      .sort("-createdAt")

      .limit(pageSize ? pageSize : 0)
      .skip(pageSize ? pageSize * (page - 1) : 0)
      .populate("actor", "-_id username id profile publicKey");
    let totalItems = await Feed.countDocuments(query);

    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      // id: `https//${settings.domain}${id ? "/" + id : ""}`,
      summary: `${Kowloon.settings.title} | Feeds`,
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
