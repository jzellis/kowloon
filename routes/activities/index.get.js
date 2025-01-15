// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";

export default async function (req, res) {
  let status = 200;
  let page = req.query.page || 1;
  let pageSize = req.query.pageSize || 20;
  let query = { to: "@public" };
  if (req.user?.local === true) query.to = { $in: ["@public", "@server"] };
  let response = await Kowloon.getActivities(query, {
    id: "activities",
    summary: "Public",
  });

  res.status(status).json(response);
}
