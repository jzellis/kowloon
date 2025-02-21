import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  if (req.user || req.user.id != req.params.id) {
    let query = {
      $or: [
        { actorId: req.user.id },
        { to: req.user.id },
        { cc: req.user.id },
        { bcc: req.user.id },
      ],
    };
    response = await Kowloon.getFeed(query, {
      page: req.query.page || 1,
      actorId: req.user.id,
    });
    response.queryTime = Date.now() - qStart;
  } else {
    response = { error: "You are not authorized to see posts here" };
  }
  res.status(status).json(response);
}
