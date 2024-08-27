// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let query = {};
  if (req.user?.blocked.length > 0) query["id"] = { $nin: req.user.blocked };
  if (req.user?.muted.length > 0) query["id"] = { $nin: req.user.muted };
  let users = await Kowloon.getUsers(query);
  let response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    id: "//" + Kowloon.settings.domain,
    summary: `${Kowloon.settings.title} | Public Users`,
    totalItems: users.length,
    page,
    items: users.map((u) => u.id),
    queryTime: 0,
  };
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
