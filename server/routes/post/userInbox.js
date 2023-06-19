import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let status = 200;
  const activity = req.body;
  let response = await Kowloon.addToInbox(activity);

  res.status(status).json(response);
}
