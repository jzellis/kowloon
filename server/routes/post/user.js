import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let response = {};
  let status = 200;

  Kowloon.setUser(req.user || undefined);

  if (Kowloon.user && Kowloon.user.username == req.params.username) {
    let user = req.body;
    response = await Kowloon.updateUser(user);
  }

  res.status(status).json(response);
}
