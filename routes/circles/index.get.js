// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  response = await Kowloon.getCircles({ to: "@public" });
  response.time = Date.now() - qStart;
  res.status(status).json(response);
}
