import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let response = Kowloon.settings;
  let status = 200;

  res.status(status).json(response);
}
