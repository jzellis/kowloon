import Kowloon from "../../Kowloon.js";
import { Group } from "../../schema/index.js";
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

  let group = await Group.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason -approval -bcc -rbcc -object.bcc -object.rbcc -deletedAt -deletedBy -_id -__v -members -admins -pending -banned"
  );
  if (group) {
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Group",
      group,
    };
    // response.activities = await Group.find(query);
  } else {
    response.error = "Group not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
