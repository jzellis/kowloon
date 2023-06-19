import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let status = 401;
  Kowloon.setUser(req.user || undefined);
  if (Kowloon.user) {
    status = 201;
    const activity = req.body;
    activity.owner = Kowloon.user._id;
    if (Kowloon.validateActivity(activity)) {
      response = await Kowloon.addToOutbox(req.body);
      if (response.error) status = 400;
    } else {
      status = 401;
      response = Kowloon.validateActivity();
    }
  }
  res.status(status).json(response);
}
