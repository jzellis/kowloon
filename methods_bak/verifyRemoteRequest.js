import crypto from "crypto";
import { User } from "../schema/index.js";
export default async function (id, token) {
  token = Buffer.from(token, "base64");
  let user = await User.findOne({ id });
  if (user) {
    try {
      let decrypted = crypto
        .privateDecrypt(user.keys.private, token)
        .toString("utf-8");
      return decrypted;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}
