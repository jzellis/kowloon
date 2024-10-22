import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;

  res
    .status(status)
    .send(await Kowloon.login(req.body.username, req.body.password));
}
