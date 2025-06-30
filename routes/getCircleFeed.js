import Kowloon from "../Kowloon.js";
import { Circle } from "../schema/index.js";
import updateFeed from "../methods/updateFeed.js";

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = { server: req.server };
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;

  let circle = await Circle.findOne({ id: req.params.id }).select(
    "-_id id url icon server name actorId members memberCount"
  );
  if (
    circle?.to === "@public" ||
    (req.user && circle?.actorId === req.user.id)
  ) {
    try {
      let items = await updateFeed(req.user.id || null, req.params.id);
      let totalItems = items.length;
      items = items.slice(0, page * pageSize);

      response = {
        server: req.server,
        circle,
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "OrderedCollection",
        summary: `${Kowloon.settings.profile.name} | ${
          circle.name || circle.id
        } | page ${page}`,
        totalItems,
        totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
        items,
        url: `${req.protocol}://${req.hostname}${req.originalUrl}`,
        //   query,
      };

      response.queryTime = Date.now() - qStart;
      res.status(status).json(response);
    } catch (e) {
      console.error("Error fetching circle feed:", e);
      res.status(500).json({ error: e });
    }
  } else {
    res.status(403).json({
      error: "You are not allowed to access this circle's feed.",
    });
  }
}
