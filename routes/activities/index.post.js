// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Activity } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  response.activity = await Kowloon.createActivity(req.body.activity);
  response.time = Date.now() - qStart;
  res.status(status).json(response);
}
