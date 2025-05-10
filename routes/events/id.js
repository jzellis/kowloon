import Kowloon from "../../Kowloon.js";
import { Event } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    ...(await Kowloon.generateQuery(req.user?.id)),
    id: req.params.id,
  };

  let event = await Event.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
  );
  if (event) {
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Event",
      event,
    };
    // response.activities = await Event.find(query);
  } else {
    response.error = "Event not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
