// Returns all public activities from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let user = await Kowloon.getUser(req.params.id);
  if (!user) {
    res.status(200).json({ error: "User not found" });
  } else {
    let query = req.user
      ? {
          actorId: user.id,
          $or: [
            { public: true },
            { to: req.user.id },
            { bto: req.user.id },
            { cc: req.user.id },
            { bcc: req.user.id },
          ],
        }
      : { actorId: user.id, public: true };
    if (req.user?.id === user.id) query["$or"].push({ actorId: user.id });
    if (req.user?.blocked.length > 0)
      query["actorId"] = { $nin: req.user.blocked };
    if (req.user?.muted.length > 0) query["actorId"] = { $nin: req.user.muted };

    let response = await Kowloon.getActivities(query, {
      actor: true,
      page,
      summary: `${user.profile.name} (${user.username})`,
    });

    res.status(status).json(response);
  }
}
