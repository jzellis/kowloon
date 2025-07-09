import Kowloon from "../Kowloon.js";
import { Circle, User, UserFeed, TimelineCache } from "../schema/index.js";

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = { server: req.server };
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = {};

  if (req.query.sort) {
    sort = `-${req.query.sort}`;
  } else {
    sort = `-updatedAt`;
  }
  if (req.user && req.user.id == req.params.id) {
    let circleId = req.query.circleId || req.user.following;
    let circle = await Circle.findOne({ id: circleId }).select("name").lean();
    let query = { actorId: req.user.id, circleId };
    let totalItems = await UserFeed.countDocuments(query);
    if (
      totalItems == 0 ||
      req.user.feedRefreshedAt < new Date(Date.now() - 5 * 60 * 1000)
    ) {
      await Kowloon.updateFeed(req.user.id, circleId);
      totalItems = await UserFeed.countDocuments(query);
    }

    let feed = await UserFeed.find(query)
      .limit(pageSize ? pageSize : 0)
      .skip(pageSize ? pageSize * (page - 1) : 0)
      .sort(sort)
      .lean();

    let items = await TimelineCache.find({
      id: { $in: feed.map((p) => p.postId) },
    })
      .select("-_id -__v")
      .lean();

    items.forEach((p, i) => {
      p.read = feed[i].read;
      p.canReact = feed[i].canReact;
      p.canReply = feed[i].canReply;
      p.canShare = feed[i].canShare;
    });

    response = {
      server: req.server,
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      summary: `${req.user.id} | ${circle.name} Posts | page ${page}`,
      totalItems,
      totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
      items,
      url: `${req.protocol}://${req.hostname}${req.originalUrl}`,
      timestamp: Date.now(),
    };

    try {
      JSON.stringify(response);
    } catch (err) {
      console.error("Cannot stringify response:", err.message);
    }

    response.queryTime = Date.now() - qStart;
    res.status(status).json(response);
  } else {
    req.status(403).json({ error: "You cannot see this user's timeline" });
  }
}
