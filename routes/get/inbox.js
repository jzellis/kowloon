import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let response = {};
  if (!req.user) {
    status = 401;
    response.error = "Must be logged in";
  } else {
    response = await Kowloon.getInbox(req.user.id, {
      page: req.query.page || 1,
    });
  }
  res.status(status).json(response);
}
