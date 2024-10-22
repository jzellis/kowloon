import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let response = {};
  if (req.user) {
    let activity = req.body.activity;
    if (!activity.actorId) activity.actorId = req.user.id;
    try {
      response = { activity: await Kowloon.createActivity(activity) };
    } catch (e) {
      status = 500;
      response = { error: e };
    }
  } else {
    status = 401;
    response = { error: "You must be a Kowloon user to post an activity." };
  }

  res.status(status).json(response);
}
