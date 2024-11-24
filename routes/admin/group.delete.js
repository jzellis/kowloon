// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Group } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  response.group = await Group.updateOne(
    { id: req.query.id },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: req.user.id,
      },
    }
  );

  res.status(status).json(response);
}
