import Kowloon from "../../Kowloon.js";
import Circle from "../../schema/Circle.js";
import util from "util";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  let from = req.query.from || []; // Filters by authors
  let type = req.query.type || []; // Filters by authors
  let query = req.user
    ? {
        $or: [
          { to: { $in: [...req.user.memberships, req.user.id, "@public"] } },
          { cc: { $in: [...req.user.memberships, req.user.id, "@public"] } },
          { bcc: { $in: [...req.user.memberships, req.user.id, "@public"] } },

          // { to: "@public" },
        ],
        // actorId: { $nin: [...req.user.blocked, req.user.muted] },
      }
    : { to: "@public" };
  if (from.length > 0) query.actorId = { $in: from };
  if (type.length > 0) query.type = { $in: type };
  if (req.user && req.query.circle) {
    let circle = await Circle.findOne({ id: req.query.circle });
    query.actorId = {
      $in: [...circle.members, circle.id],
      $nin: [...req.user.blocked, req.user.muted],
    };
  }

  console.log(util.inspect(query, false, null, true));
  // let posts = (
  //   await Kowloon.getFeed(query, {
  //     page: req.query.page || 1,
  //   })
  // ).items;
  // let activities = (
  //   await Kowloon.getActivities(query, {
  //     page: req.query.page || 1,
  //   })
  // ).items;
  // let bookmarks = (
  //   await Kowloon.getBookmarks(query, {
  //     page: req.query.page || 1,
  //   })
  // ).items;
  // let nozzle = posts
  //   .concat(activities, bookmarks)
  //   .sort((a, b) => a.createdAt < b.createdAt);
  // response = {
  //   items: nozzle,
  //   queryTime: Date.now() - qStart,
  // };

  response = await Kowloon.getFeed(query, {
    page: req.query.page || 1,
  });
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
