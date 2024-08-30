// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let user = await Kowloon.getUser(req.params.id);
  if (!user) {
    res.status(500).json({ error: "User not found" });
  } else {
    let query = req.user
      ? {
          $or: [{ actorId: user.id }, { members: user.id }],
        }
      : { $or: [{ actorId: user.id }, { members: user.id }], public: true };
    if (req.user?.blocked.length > 0)
      query["actorId"] = { $nin: req.user.blocked };
    if (req.user?.id != user.id) query.public = true;

    let response = await Kowloon.getGroups(query, {
      actor: false,
      page,
      summary: `${user.profile.name} (${user.username})`,
    });

    res.status(status).json(response);
  }
}
