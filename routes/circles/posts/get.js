// Returns all public posts from the server

import Kowloon from "../../../../Kowloon.js";

export default async function (req, res) {
  let status = 200;
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.pageSize || 20;
  let circle = await Kowloon.getCircle(req.params.id);
  if (group.public === false && circle.actorId != req.user?.id) {
    response.error = "Circle not found";
  } else {
    let query = {
      actorId: { $in: circle.members },
      to: { $or: ["@_public", req.user?.id] },
    };
    try {
      response = await Kowloon.getPosts(query, {
        id: "circle",
        summary: circle.name,
        page,
      });
    } catch (e) {
      response.error = e;
    }
  }
  res.status(status).json(response);
}
