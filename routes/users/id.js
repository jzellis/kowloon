import Kowloon from "../../Kowloon.js";
import { User } from "../../schema/index.js";

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let query = { id: req.params.id };
  let user = await User.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason -bcc -rbcc -object.bcc -object.rbcc -deletedAt -deletedBy -_id -__v -source"
  );
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
