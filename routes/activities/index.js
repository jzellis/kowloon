import Kowloon from "../../Kowloon.js";
import util from "util";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let query = req.user
    ? {
        $or: [
          { actorId: req.user.id },
          { to: { $in: [...req.user.memberships, req.user.id] } },
          { cc: { $in: [...req.user.memberships, req.user.id] } },
          { bcc: { $in: [...req.user.memberships, req.user.id] } },

          { to: "@public" },
        ],
      }
    : { to: "@public" };
  let activities = await Kowloon.getActivities(query, {
    page: req.query.page || 1,
  });
  let response = {
    activities,
    queryTime: Date.now() - qStart,
  };

  res.status(status).json(response);
}
