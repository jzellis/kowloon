import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  Kowloon.setUser(req.user || null);
  let user = await Kowloon.getUser({ username: req.params.username });
  let response =
    Kowloon.user && user.id == Kowloon.user.id
      ? user.actor
      : Kowloon.sanitize(user.actor);
  let status = 200;

  res.status(status).json(response);
}
