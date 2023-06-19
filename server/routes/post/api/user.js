import Kowloon from "../../../kowloon/index.js";

export default async function handler(req, res, next) {
  let status = 401;
  let response = {};

  let user = req.body;
  try {
    response = await Kowloon.createUser(user);
    status = 201;
  } catch (e) {
    response = { error: e };
  }
  res.status(status).json(response);
}
