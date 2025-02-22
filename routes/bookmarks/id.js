import Kowloon from "../../Kowloon.js";
import { Bookmark } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    id: req.params.id,
    to: {
      $in: ["@public", req.user?.id, req.server?.id].concat(
        req.user?.memberships,
        req.server?.memberships
      ),
    },
  };
  if (req.user?.id && req.user.id.split("@").pop() === Kowloon.settings.domain)
    query.to.$in.push("@server");

  let bookmark = await Bookmark.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason -bcc -rbcc -object.bcc -object.rbcc -deletedAt -deletedBy -_id -__v -source"
  );
  if (bookmark) {
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Bookmark",
      bookmark,
    };
    // response.activities = await Bookmark.find(query);
  } else {
    response.error = "Bookmark not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
