// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { User } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  response.activity = await User.updateOne(
    { id: req.query.id },
    { $set: req.body.activity }
  );

  res.status(status).json(response);
}
