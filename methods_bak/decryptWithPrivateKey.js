import crypto from "crypto";
import { User } from "../schema/index.js";

export default async function (actorId, message) {
  let user = await User.findOne({ id: actorId });
  let privateKey = user.keys.private;
  return crypto.privateDecrypt(privateKey, encryptedMessage);
}
