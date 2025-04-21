import Kowloon from "../../Kowloon.js";

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  response[Kowloon.parseId(req.params.id).type.toLowerCase()] =
    await Kowloon.getObjectById(req.params.id, req.user?.id || null);
  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
