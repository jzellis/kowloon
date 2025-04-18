import Kowloon from "../../Kowloon.js";
import { Activity } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    id: req.params.id,
  };

  let activity = await Activity.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
  );
  if (activity) {
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Activity",
      activity,
    };
    // response.activities = await Activity.find(query);
  } else {
    response.error = "Activity not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
