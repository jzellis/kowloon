// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Settings } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let response = {};

  let blocked = (await Settings.findOne({ name: "blockedDomains" }).lean())
    .value;

  response = {
    blocked,
  };
  res.status(status).json(response);
}
