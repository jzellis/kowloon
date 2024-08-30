// Returns all public circles from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let query = req.user
    ? {
        $or: [{ public: true }, { actorId: req.user.id }],
      }
    : { public: true };
  if (req.user?.blocked.length > 0)
    query["actorId"] = { $nin: req.user.blocked };
  if (req.user?.muted.length > 0) query["actorId"] = { $nin: req.user.muted };
  let response = await Kowloon.getCircles(query, {
    actor: true,
    page,
  });

  res.status(status).json(response);
}
