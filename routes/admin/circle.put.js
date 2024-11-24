// Returns all public circles from the server

import Kowloon from "../../Kowloon.js";
import { Circle } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  response.circle = await Circle.create(req.body.circle);

  res.status(status).json(response);
}
