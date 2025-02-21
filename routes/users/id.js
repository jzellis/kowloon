import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let query = { id: req.params.id };
  let user = await Kowloon.getUser(query);
  let response = {
    queryTime: Date.now() - qStart,
  };

  if (user) {
    response.user = user;
  } else {
    response.error = "User not found";
  }

  res.status(status).json(response);
}
