// Returns all public posts from the server

import Kowloon from "../../../../Kowloon.js";
import Circle from "../../../../schema/Circle.js";
import User from "../../../../schema/User.js";

export default async function (req, res) {
  let status = 200;
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.pageSize || 20;
  let user = await User.findOne({
    $or: [{ id: req.params.id }, { username: req.params.id }],
  }).select("-password -keys.private");
  let userBlocked = await Circle.findOne({ id: user?.blocked });
  let userBlocks = userBlocked?.members;

  let query = { actorId: user.id };
  if (req.query.type) query.type = req.query.type.split(",");

  if (!userBlocks.includes(req.user?.id)) {
    if (req.user) {
      if (req.user.blockedUsers.includes(req.params.id)) {
        response.error = "You have blocked this user";
      }
      let allAddr = [req.user?.id, "@public"];
      if (await Kowloon.isLocal(req.user.id)) allAddr.push("@server");
      // query.to = { $elemMatch: { $in: allAddr } };
      // query.cc =
      query.$or = [
        {
          to: { $elemMatch: { $in: allAddr } },
        },
        {
          cc: { $elemMatch: { $in: req.user.memberships } },
        },
        {
          bcc: { $elemMatch: { $in: req.user.memberships } },
        },
      ];
    } else {
      query.to = "@public";
    }
  } else {
    response.error = "User posts are not available";
  }
  try {
    response = await Kowloon.getPosts(query, {
      id: "posts",
      title: `${user.username} (${user.id})`,
      summary: user.username,
      page,
    });
    response.actor = {
      id: user.id,
      href: user.url,
      profile: user.profile,
      keys: { public: user.keys.public },
    };
  } catch (e) {
    console.log(e);
    response.error = e;
  }
  res.status(status).json(response);
}
