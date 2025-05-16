import Kowloon from "../../Kowloon.js";
import { Circle } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    ...(await Kowloon.generateQuery(req.user?.id)),
    id: req.params.id,
  };

  let circle = await Circle.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
  );
  if (circle) {
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Circle",
      circle,
    };
    // response.activities = await Circle.find(query);
  } else {
    response.error = "Circle not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
