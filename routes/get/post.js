// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let query = req.user
    ? {
        id: req.params.id,
        $or: [
          { public: true },
          { actorId: req.user.id },
          { to: req.user.id },
          { bto: req.user.id },
          { cc: req.user.id },
          { bcc: req.user.id },
        ],
      }
    : { id: req.params.id, public: true };
  if (req.user?.blocked.length > 0)
    query["actorId"] = { $nin: req.user.blocked };
  // if (req.user?.muted.length > 0) query["actorId"] = { $nin: req.user.muted };
  let post = await Kowloon.getPost(query);
  let response = {
    post,
  };
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
