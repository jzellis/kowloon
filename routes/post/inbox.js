import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let response = {};

  qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
