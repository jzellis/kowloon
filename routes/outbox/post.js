import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  if (req.user && req.body.activity) {
    req.body.activity.actorId = req.user.id;
    response.activity = await Kowloon.createActivity(req.body.activity);
  } else {
    response.error = !req.user
      ? "No user specified"
      : !req.activity
      ? "No activity specified"
      : "Undetermined error";
  }

  res.status(status).json(response);
}
