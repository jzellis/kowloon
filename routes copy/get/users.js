// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let query = {};
  if (req.user?.blocked.length > 0) query["id"] = { $nin: req.user.blocked };
  if (req.user?.muted.length > 0) query["id"] = { $nin: req.user.muted };
  let response = await Kowloon.getUsers(query);

  res.status(status).json(response);
}
