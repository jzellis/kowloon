import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {
    queryTime: Date.now() - qStart,
  };
  response = await Kowloon.login(req.body.username, req.body.password);

  res.status(status).send(response);
}
