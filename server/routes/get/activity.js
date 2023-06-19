import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  Kowloon.setUser(req.user || null);
  let response = (await Kowloon.getActivity(req.params.id)) || {
    error: "No activity found",
  };

  let status = 200;

  res.status(status).json(response);
}
