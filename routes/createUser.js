import { User } from "#schema";

export default async function (req, res, next) {
  let status = 201;
  let qStart = Date.now();
  let response = {
    server: req.server,
    type: req.type,
  };

  let user = req.body.user;

  try {
    let created = await User.create(user);
    response.user = created.toObject();
    response.status = "success";
    response.time = Date.now() - qStart;
  } catch (err) {
    response.error = err.message;
    response.status = "error";
    response.time = Date.now() - qStart;
  }
  res.status(status).json(response);
}
