import Kowloon from "../../Kowloon.js";
import { Circle } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = {};
  if (req.query.sort) {
    sort[req.query.sort] = -1;
  } else {
    sort.updatedAt = -1;
  }
  let response = {};
  let query = {
    ...(await Kowloon.generateQuery(req.user?.id)),
    id: req.params.id,
  };

  let circle = await Circle.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source -members"
  );

  if (circle) {
    let items = circle.members || [];
    let totalItems = items.length;
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
      count: items.length || 0,
      items,
    };
    // response.activities = await Circle.find(query);
  } else {
    response.error = "Circle not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
