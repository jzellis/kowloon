// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let type = req.query.type || null;
  let circle = await Kowloon.getCircle(req.params.id);
  let canView = circle.public == true || circle.actorId == req.user?.id;
  // canView = circle.members.indexOf(req.user?.id) != -1;

  if (!circle) {
    res.status(500).json({ error: "Circle not found" });
  } else {
    let query = req.user
      ? {
          actorId: { $in: circle.members },
        }
      : { circles: circle.id, public: true };
    if (!canView) query.public = true;
    if (type) query.type = type;
    console.log(query);
    let posts = await Kowloon.getPosts(query, {
      actor: true,
      page,
    });
    let response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      id: "//" + Kowloon.settings.domain,
      summary: `${Kowloon.settings.title} | ${circle.name} | Public Posts`,
      totalItems: posts.length,
      page,
      items: posts,
      queryTime: 0,
    };
    let qEnd = Date.now();
    response.queryTime = qEnd - qStart;
    res.status(status).json(response);
  }
}
