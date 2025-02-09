import { query } from "express";
import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let group = await Kowloon.getGroup({ id: req.params.id });
  let response = {
    queryTime: Date.now() - qStart,
  };

  if (group) {
    response.group = group;
  } else {
    response.error = "Group not found";
  }

  res.status(status).json(response);
}
