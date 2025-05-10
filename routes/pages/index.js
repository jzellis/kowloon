import Kowloon from "../../Kowloon.js";
import { Page } from "../../schema/index.js";
import buildPageTree from "../../methods/buildPageTree.js";
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
  let query = await Kowloon.generateQuery(req.user?.id);
  let items = await Page.find(query)
    .select(
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
    )
    .lean();
  items = buildPageTree(items);
  let totalItems = await Page.countDocuments(query);

  response = {
    "@context": "https://www.w3.org/ns/pagestreams",
    type: "OrderedCollection",
    // id: `https//${settings.domain}${id ? "/" + id : ""}`,
    summary: `${Kowloon.settings.profile.name} | Activities`,
    totalItems,
    totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
    currentPage: parseInt(page) || 1,
    firstItem: pageSize * (page - 1) + 1,
    lastItem: pageSize * (page - 1) + items.length,
    count: items.length,
    items,
  };
  // response.files = await Page.find(query);
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
