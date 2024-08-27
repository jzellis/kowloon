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
  let circles = await Kowloon.getCircles(query, {
    actor: true,
    page,
  });
  let response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    id: "//" + Kowloon.settings.domain,
    summary: `${Kowloon.settings.title} | Public Circles`,
    totalItems: circles.length,
    page,
    items: circles,
    queryTime: 0,
  };
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
