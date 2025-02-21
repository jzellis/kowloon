import Kowloon from "../../Kowloon.js";
import { User } from "../../schema/index.js";
import crypto from "crypto";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  let id = req.headers["kowloon-id"];
  let timestamp = req.headers["kowloon-timestamp"];
  let signature = req.headers["kowloon-signature"];
  let type = req.headers["kowloon-type"];

  if (!id) response.error = "Missing Kowloon-Id header";
  if (!timestamp) response.error = "Missing Kowloon-Timestamp header";
  if (!signature) response.error = "Missing Kowloon-Signature header";
  if (!type)
    response.error =
      "Missing Kowloon-Type header (should be 'user' or 'server')";

  if (type === "user") {
    let user = await Kowloon.verifyUserSignature(id, timestamp, signature);
    if (user) {
      response.user = user;
    } else {
      response.error = "User cannot be authenticated";
    }
  }
  if (type === "server") {
    let server = await Kowloon.verifyServerSignature(id, timestamp, signature);
    if (server) {
      response.server = server;
    } else {
      response.error = "Server cannot be authenticated";
    }
  }
  res.status(status).json(response);
}
