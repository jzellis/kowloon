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
    sort.createdAt = -1;
  }
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

  query = {
    $or: [{ to: group.id }, { cc: group.id }, { bcc: group.id }],
  };

  let items = await Post.find(query)
    .select(
      "-flaggedAt -flaggedBy -flaggedReason -bcc -rbcc -object.bcc -object.rbcc -deletedAt -deletedBy -_id -__v -source"
    )
    .limit(pageSize ? pageSize : 0)
    .skip(pageSize ? pageSize * (page - 1) : 0)
    .sort({ sort: -1 })
    .populate("actor", "-_id username id profile publicKey");
  let totalItems = await Post.countDocuments(query);

  if (group) {
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      group,
      totalItems,
      totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
      currentPage: parseInt(page) || 1,
      firstItem: pageSize * (page - 1) + 1,
      lastItem: pageSize * (page - 1) + items.length,
      count: items.length,

      items,
    };
    // response.activities = await Group.find(query);
  } else {
    response.error = "Group not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
