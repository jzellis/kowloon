import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let response = {};
  // if (req.body.activity?.type !req.user) {
  //   status = 401;
  //   response.error = "You are not authorized to post an activity.";
  // } else {
  let activity = req.body.activity;
  response.activity = await Kowloon.createActivity(activity);
  // }
  res.status(status).json(response);
}
