import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let status = 401;
  let response = {};
  Kowloon.setUser(req.user || undefined);
  if (Kowloon.user.isAdmin == true) {
    status = 200;
    if (req.body || req.body.settings) {
      // update settings code goes here
    }
  }

  res.status(status).json(response);
}
