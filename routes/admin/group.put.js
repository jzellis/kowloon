// Returns all public groups from the server

import Kowloon from "../../Kowloon.js";
import { Group } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  response.group = await Group.create(req.body.group);

  res.status(status).json(response);
}
