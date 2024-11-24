// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";

export default async function (req, res) {
  let status = 200;
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.pageSize || 20;
  let query = { to: ["@_public"] };
  try {
    response = await Kowloon.getPosts(query, {
      id: "activities",
      summary: "Public",
      page,
      actor: true,
    });
  } catch (e) {
    response.error = e;
  }
  res.status(status).json(response);
}
