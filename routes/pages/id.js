import Kowloon from "../../Kowloon.js";
import { Page } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    ...(await Kowloon.generateQuery(req.user?.id)),
    $or: [{ id: req.params.id }, { slug: req.params.id }],
  };

  let page = await Page.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
  );
  if (page) {
    response = {
      "@context": "https://www.w3.org/ns/page",
      type: "Page",
      page,
    };
    // response.activities = await Page.find(query);
  } else {
    response.error = "Page not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
