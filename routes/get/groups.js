// Returns all public groups from the server

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
          { members: req.user.id },
        ],
      }
    : { public: true };
  let groups = await Kowloon.getGroups(query, {
    actor: true,
    page,
  });
  let response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    id: "//" + Kowloon.settings.domain,
    summary: `${Kowloon.settings.title} | Public Groups`,
    totalItems: groups.length,
    page,
    items: groups,
    queryTime: 0,
  };
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
