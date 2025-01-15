// Returns all public posts from the server

import Kowloon from "../../../../Kowloon.js";

export default async function (req, res) {
  let status = 200;
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.pageSize || 20;
  let group = await Kowloon.getGroup(req.params.id);
  let query = { to: group.id };
  if (!group.to.includes("@public") && !group.members.includes(req.user?.id)) {
    return res
      .status(403)
      .json({ error: "You are not a member of this group" });
  }
  try {
    response = await Kowloon.getPosts(query, {
      id: "posts",
      summary: group.name,
      page,
    });
  } catch (e) {
    response.error = e;
  }

  res.status(status).json(response);
}
