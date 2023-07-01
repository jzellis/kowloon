import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let response = {};
  let status = 200;
  const { username, password } = req.body;
  console.log("Login: ", req.body);
  response = await Kowloon.login({ username, password });
  res.status(status).json(response);
}
