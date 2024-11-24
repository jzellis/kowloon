import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  let user = await Kowloon.auth(
    req.headers["kowloon-id"],
    req.headers.authorization
  );
  res.status(status).json(user);
}
