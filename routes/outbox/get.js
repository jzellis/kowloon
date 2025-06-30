import Kowloon from "../../Kowloon.js";
import generateQuery from "../../methods/generateQuery.js";
import { Post } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  res.status(status).json(response);
}
