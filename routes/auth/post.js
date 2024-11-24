import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let user = await Kowloon.auth(req.body.id, req.body.token);
  res.status(status).json(user);
}
