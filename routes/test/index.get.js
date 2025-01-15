// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";

export default async function (req, res) {
  let status = 200;
  let response = {};
  response.memberships = await Kowloon.getUserMemberships(
    "@admin@kowloon.social"
  );
  res.status(status).json(response);
}
