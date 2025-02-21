import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let user = await Kowloon.login(req.body.username, req.body.password);
  let response = {
    queryTime: Date.now() - qStart,
  };

  if (!user.error) {
    response = user;
    response.queryTime = Date.now() - qStart;
  } else {
    response.error = user.error;
  }

  res.status(status).json(response);
}
