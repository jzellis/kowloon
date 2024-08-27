// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let type = req.query.type || null;

  let group = await Kowloon.getGroup(req.params.id);
  let canView =
    group.public == true || group.members.indexOf(req.user?.id) != -1;
  // canView = group.members.indexOf(req.user?.id) != -1;
  console.log(group.public == true);
  console.log(group.members.indexOf(req.user?.id));
  console.log(canView);
  if (!group) {
    res.status(500).json({ error: "Group not found" });
  } else {
    let query = req.user
      ? {
          groups: group.id,
        }
      : { groups: group.id, public: true };
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
      summary: `${Kowloon.settings.title} | ${group.name} | Public Posts`,
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
