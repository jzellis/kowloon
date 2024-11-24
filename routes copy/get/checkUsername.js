// Returns all public posts from the server

import { use } from "marked";
import { User } from "../../schema/index.js";

export default async function (req, res) {
  let status = 200;
  let query = req.query.username;
  let user = await User.findOne({ username: query }).lean();
  let response = {
    // exists: user ? true : false,
    user,
  };
  res.status(status).json(response);
}
