// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";

export default async function (req, res) {
  let status = 200;
  let response = {};
  response.user = await Kowloon.isLocal("@admin@kowloon.social");
  res.status(status).json(response);
}
