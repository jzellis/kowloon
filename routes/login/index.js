import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {
    queryTime: Date.now() - qStart,
  };
  try {
    let user = await Kowloon.login(req.body.username, req.body.password);
    if (!user.error) {
      response = user;
      response.queryTime = Date.now() - qStart;
    } else {
      console.log(error);
      response.error = user.error;
    }
  } catch (error) {
    response.error = error;
  }

  res.status(status).json(response);
}
