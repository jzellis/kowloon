import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    $or: [{ to: req.params.id }, { cc: req.params.id }, { bcc: req.params.id }],
  };
  if (req.user) query.actorId = req.user.id;
  let isPublic = await Kowloon.getGroup({ id: req.params.id, to: "@public" });
  let hasAccess = isPublic
    ? true
    : req.user.memberships.indexOf(req.params.id) !== -1;
  if (!hasAccess) {
    response.error = "You are not authorized to see posts from this group";
  } else {
    let posts = await Kowloon.getPosts(query);
    response = {
      posts,
      queryTime: Date.now() - qStart,
    };
  }
  res.status(status).json(response);
}
