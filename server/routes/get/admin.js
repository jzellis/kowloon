import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let response = await Kowloon.stats();
  let status = 200;

  res.status(status).json(response);
}
