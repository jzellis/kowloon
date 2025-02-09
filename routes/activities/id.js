import { query } from "express";
import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let activity = await Kowloon.getActivity({ id: req.params.id });
  let response = {
    queryTime: Date.now() - qStart,
  };

  if (activity) {
    response.activity = activity;
  } else {
    response.error = "Activity not found";
  }

  res.status(status).json(response);
}
