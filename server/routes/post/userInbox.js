import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let response = {};
  let status = 200;
  const activity = req.body;
  response = await Kowloon.addToInbox(activity);

  res.status(status).json(response);
}
