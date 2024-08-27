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
  let activities = await Kowloon.getActivities(query, {
    actor: true,
    likes: true,
    page,
  });
  let response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    id: "//" + Kowloon.settings.domain,
    summary: `${Kowloon.settings.title} | Public Activities`,
    totalItems: activities.length,
    page,
    items: activities,
    queryTime: 0,
  };
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
