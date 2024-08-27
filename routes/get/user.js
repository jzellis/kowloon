// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let query = req.params.id;
  let user = await Kowloon.getUser(query);
  let response = {
    user,
  };
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
