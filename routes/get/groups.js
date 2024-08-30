// Returns all public groups from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let page = req.query.page || 1;
  let query = req.user
    ? {
        $or: [
          { public: true },
          { actorId: req.user.id },
          { members: req.user.id },
        ],
      }
    : { public: true };
  let response = await Kowloon.getGroups(query, {
    actor: true,
    page,
  });

  res.status(status).json(response);
}
