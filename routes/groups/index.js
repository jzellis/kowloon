import { query } from "express";
import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let groups = await Kowloon.getGroups(
    { to: "@public" },
    {
      page: req.query.page || 1,
    }
  );
  let response = {
    groups,
    queryTime: Date.now() - qStart,
  };

  res.status(status).json(response);
}
