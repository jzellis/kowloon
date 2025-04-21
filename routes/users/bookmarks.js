import Kowloon from "../../Kowloon.js";
import buildBookmarkTree from "../../methods/buildBookmarkTree.js";
import { Bookmark } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  let query = {
    actorId: req.params.id,
    to: {
      $in: ["@public", req.user?.id, req.server?.id].concat(
        req.user?.memberships,
        req.server?.memberships
      ),
    },
  };
  if (req.user?.id && req.user.id.split("@").pop() === Kowloon.settings.domain)
    query.to.$in.push("@server");
  // if (req.query.type) query.type = req.query.type;
  if (req.user) query.from = { $nin: req.user.blocked.concat(req.user.muted) };
  if (req.query.since)
    query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
  let items = await Bookmark.find(query)
    .select(" -deletedAt -deletedBy -_id -__v -source")
    .lean();

  let totalItems = await Bookmark.countDocuments(query);
  let tree = buildBookmarkTree(items);
  items = tree;

  response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    // id: `https//${settings.domain}${id ? "/" + id : ""}`,
    summary: `${Kowloon.settings.profile.name} | Bookmarks`,
    totalItems,
    items,
  };
  // response.activities = await Bookmark.find(query);
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
