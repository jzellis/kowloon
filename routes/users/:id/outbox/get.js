import Kowloon from "../../../../Kowloon.js";
import { Circle } from "../../../../schema/index.js";
export default async function (req, res) {
  let actor = await Kowloon.getUser(req.params.id);
  let status = 200;
  let response = {};
  let query = { to: "@public" };
  if (req.user) {
    let circles = (
      await Circle.find({ members: req.user.id, deletedAt: null })
        .select("id")
        .lean()
    ).map((c) => c.id);
    query = {
      to: { $in: ["@public", req.user.id] },
      cc: { $in: [circles] },
    };
  }
  if (req.user?.local === true) query.to = { $in: ["@public", "@server"] };
  response.items = await Kowloon.getUserOutbox(actor.id);
  res.status(status).json(response);
}
