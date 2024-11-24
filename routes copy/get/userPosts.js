// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Circle, Group } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let type = req.query.type || null;

  let user = await Kowloon.getUser(req.params.id);
  if (!user) {
    res.status(500).json({ error: "User not found" });
  } else {
    let query = req.user
      ? {
          actorId: user.id,
          $or: [
            { public: true },
            { to: req.user.id },
            { cc: req.user.id },
            { bcc: req.user.id },
          ],
        }
      : { actorId: user.id, public: true };
    if (req.user?.id) {
      let circles = (
        await Circle.find({ actorId: user.id, members: req.user.id })
      ).map((c) => c.id);
      let groups = (
        await Group.find({ actorId: req.user.id, members: req.user.id })
      ).map((g) => g.id);
      query["$or"].circles = { $in: circles };
      query["$or"].groups = { $in: groups };
    }

    if (req.user?.id === user.id) query["$or"].push({ actorId: user.id });
    if (req.user?.blocked.length > 0)
      query["actorId"] = { $nin: req.user.blocked };
    if (req.user?.muted.length > 0) query["actorId"] = { $nin: req.user.muted };
    if (type) query.type = type;

    let response = await Kowloon.getPosts(query, {
      actor: true,
      page,
      summary: `${user.profile.name} (${user.username})`,
    });

    res.status(status).json(response);
  }
}
