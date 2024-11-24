// Returns all public posts from the server

import Kowloon from "../../../../Kowloon.js";

export default async function (req, res) {
  let status = 200;
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.pageSize || 20;
  let user = await Kowloon.getUser(req.params.id);
  let query = { actorId: req.params.id, to: "@_public" };
  try {
    response = await Kowloon.getPosts(query, {
      id: "activities",
      summary: user.username,
      page,
    });
  } catch (e) {
    response.error = e;
  }
  res.status(status).json(response);
}
