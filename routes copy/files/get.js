import Kowloon from "../../Kowloon.js";
import { File } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  let file = await File.findOne({ id: req.params.id }).select(
    "-_id -flagged -flaggedAt -deletedAt -__v"
  );
  response = { file } || { error: "File not found" };
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
