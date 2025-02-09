import { query } from "express";
import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let circle = await Kowloon.getCircle({ id: req.params.id });
  let response = {
    queryTime: Date.now() - qStart,
  };

  if (circle) {
    response.circle = circle;
  } else {
    response.error = "Circle not found";
  }

  res.status(status).json(response);
}
