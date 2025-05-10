import Kowloon from "../../Kowloon.js";
import { Group, Post } from "../../schema/index.js";
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
  let group = await Group.findOne({ id: req.params.id });
  if (
    group.to === "@public" ||
    (req.user?.id && group.members.some((m) => m.id === req.user?.id))
  ) {
    let query = { to: req.params.id };
    if (req.query.type) query.type = req.query.type.split(",");
    if (req.query.since)
      query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
    let items = await Post.find(query)
      .select(
        "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
      )
      .limit(pageSize ? pageSize : 0)
      .skip(pageSize ? pageSize * (page - 1) : 0)
      .sort({ sort: -1 });
    let totalItems = await Post.countDocuments(query);

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
    response.queryTime = Date.now() - qStart;
  } else {
    response.error = "You are not authorized to see posts from this group";
  }
  res.status(status).json(response);
}
