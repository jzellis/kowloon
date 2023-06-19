import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let response = { error: "You are not authorized to post to this outbox" };
  let status = 401;
  Kowloon.setUser(req.user || undefined);
  if (Kowloon.user) {
    status = 201;
    const activity = req.body;
    activity.owner = Kowloon.user._id;
    activity.actor = Kowloon.user.id;
    const validate = Kowloon.validateActivity(activity);
    if (validate == true) {
      response = await Kowloon.addToOutbox(req.body);
      if (response.error) status = 400;
    } else {
      status = 401;
      response = { errors: validate.errors };
    }
  }

  res.status(status).json(response);
}
