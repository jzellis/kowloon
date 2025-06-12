import Kowloon from "../../Kowloon.js";
import { Post } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = "-updatedAt";
  if (req.query.sort) {
    sort = `-${req.query.sort}`;
  }
  let query = await Kowloon.generateQuery(req.user?.id);

  if (req.query.type) query.type = req.query.type.split(",");
  if (req.query.since)
    query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
  let items = await Post.find(query)
    .sort(sort)
    .select(
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source -signature"
    )
    .limit(pageSize ? pageSize : 0)
    .skip(pageSize ? pageSize * (page - 1) : 0)
    .lean();
  let totalItems = await Post.countDocuments(query);

  let memberships = req.user
    ? [
        "@public",
        req.user.id,
        ...(await Kowloon.getUserMemberships(req.user?.id)),
      ]
    : ["@public"];
  if (req.user?.id && req.user.id.split("@").pop() === Kowloon.settings.domain)
    memberships.push(Kowloon.settings.actorId);
  items.forEach((item) => {
    item.canReply = memberships.includes(item.replyTo);
    item.canReact = memberships.includes(item.reactTo);
    item.canShare = ["@public", Kowloon.settings.actorId].includes(item.to);
    item.to = undefined;
    item.replyTo = undefined;
    item.reactTo = undefined;
  });

  response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    // id: `https//${settings.domain}${id ? "/" + id : ""}`,
    summary: `${Kowloon.settings.profile.name} | Posts`,
    totalItems,
    totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
    currentPage: parseInt(page) || 1,
    firstItem: pageSize * (page - 1) + 1,
    lastItem: pageSize * (page - 1) + items.length,
    count: items.length,
    items,
  };
  // response.posts = await Post.find(query);
  response.query = query;
  response.sort = sort;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
