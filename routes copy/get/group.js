// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let query = req.user
    ? {
        id: req.params.id,
        $or: [
          { public: true },
          { actorId: req.user.id },
          { members: req.user.id },
        ],
      }
    : { id: req.params.id, public: true };

  let group = await Kowloon.getGroup(query);
  let response = {
    group,
  };
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
