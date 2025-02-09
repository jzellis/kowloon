import { query } from "express";
import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let activities = await Kowloon.getActivities(
    { to: "@public" },
    {
      page: req.query.page || 1,
    }
  );
  let response = {
    activities,
    queryTime: Date.now() - qStart,
  };

  res.status(status).json(response);
}
