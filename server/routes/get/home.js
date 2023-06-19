import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res) {
  let response = Kowloon.settings;
  let status = 200;

  res.status(status).json(response);
}
