// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let query = req.params.id;
  let user = await Kowloon.getUser(query);
  user.endpoints = {
    posts: `${user.url}/posts`,
    activities: `${user.url}/activities`,
    circles: `${user.url}/circles`,
    groups: `${user.url}/groups`,
  };

  let response = user
    ? {
        user,
      }
    : { error: "No user found. Maybe check the spelling?" };
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
