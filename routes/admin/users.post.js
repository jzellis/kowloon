// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { User } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  response.user = await User.create(req.body.user);

  res.status(status).json(response);
}
