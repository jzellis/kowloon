import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let query = {};
  let response = await Kowloon.getUsers(query);
  res.status(status).json(response);
}
