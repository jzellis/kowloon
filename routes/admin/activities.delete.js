// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Activity } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  response.activity = await Activity.updateOne(
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
