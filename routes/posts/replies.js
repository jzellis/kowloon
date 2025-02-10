import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = req.user
    ? {
        target: req.params.id,
        $or: [
          { to: { $in: [...req.user.memberships, req.user.id] } },
          { cc: { $in: [...req.user.memberships, req.user.id] } },
          { bcc: { $in: [...req.user.memberships, req.user.id] } },
          { to: "@public" },
        ],
      }
    : { target: req.params.id, to: "@public" };

  response = await Kowloon.getReplies(query);
  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
