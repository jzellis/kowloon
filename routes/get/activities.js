// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let query = req.user
    ? {
        $or: [
          { public: true },
          { actorId: req.user.id },
          { to: req.user.id },
          { bto: req.user.id },
          { cc: req.user.id },
          { bcc: req.user.id },
        ],
      }
    : { public: true };
  if (req.user?.blocked.length > 0)
    query["actorId"] = { $nin: req.user.blocked };
  if (req.user?.muted.length > 0) query["actorId"] = { $nin: req.user.muted };
  let response = await Kowloon.getActivities(query, {
    actor: true,
    likes: true,
    page,
    id: "activities",
  });
  res.status(status).json(response);
}
