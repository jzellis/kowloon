// Returns all public posts from the server

import Kowloon from "../../../../Kowloon.js";

export default async function (req, res) {
  let status = 200;
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.pageSize || 20;
  let user = await Kowloon.getUser(req.params.id);
  let query = { actorId: user.id, to: "@public" };
  if (req.query.type) query.type = req.query.type.split(",");

  console.log(query);
  try {
    response = await Kowloon.getActivities(query, {
      id: "activities",
      summary: user.username,
      page,
    });
  } catch (e) {
    response.error = e;
  }
  res.status(status).json(response);
}
