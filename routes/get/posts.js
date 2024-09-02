// Returns all public posts from the server
import util from "util";
import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let type = req.query.type || null;

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
  if (type) query.type = type;
  if (req.user?.id) {
    let circles = (
      await Kowloon.getCircles({ members: req.user.id })
    ).items.map((c) => c.id);
    let groups = (await Kowloon.getGroups({ members: req.user.id })).items.map(
      (g) => g.id
    );
    query["$or"].circles = { $in: circles };
    query["$or"].groups = { $in: groups };
  }
  // console.log(util.inspect(query, false, null, true /* enable colors */));
  let response = await Kowloon.getPosts(query, {
    actor: true,
    page,
  });

  res.status(status).json(response);
}
