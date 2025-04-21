// This creates a verifable signature for user requests to use, so that the local server or a remote one can verify it in a handshake to verify the identity of the requesting user.

import crypto from "crypto";
import { User } from "../schema/index.js";

export default async function (id, timestamp) {
  const user = await User.findOne({ id });
  const token = id + ":" + timestamp.toString();
  const hash = crypto.createHash("sha256").update(token).digest();
  const signature = crypto
    .sign("sha256", hash, user.privateKey)
    .toString("base64");

  return { id, timestamp, signature };
}
