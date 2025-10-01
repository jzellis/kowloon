import Kowloon from "../../Kowloon.js";
import { File } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    id: req.params.id,
  };

  let file = await File.findOne(query).select(
    " -deletedAt -deletedBy -_id -__v -source"
  );
  if (file) {
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "File",
      file,
    };
    // response.activities = await File.find(query);
  } else {
    response.error = "File not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
