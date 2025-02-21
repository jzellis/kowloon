import Kowloon from "../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  // response.user = req.user || null;
  // response.server = req.server || null;

  let query = {
    type: req.query.type || ["Note", "Article", "Media", "Link", "Bookmark"],
    to: {
      $in: ["@public", req.user?.id, req.server?.id].concat(
        req.user?.memberships,
        req.server?.memberships
      ),
    },
  };
  if (req.user) query.from = { $nin: req.user.blocked.concat(req.user.muted) };
  if (req.query.since)
    query.updatedAt = { $gte: new Date(req.query.since).toISOString() };
  response = await Kowloon.getFeed(query, { actorId: req.user.id });
  response.query = query;
  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
