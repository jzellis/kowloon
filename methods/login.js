import { access } from "fs";
import { Circle, User } from "../schema/index.js";
import crypto from "crypto";
export default async function (username, password = "") {
  let user = await User.findOne({ username }).select(
    "username password profile prefs keys.public accessToken"
  );

  if (!user) return false;
  if (!(await user.verifyPassword(password))) return false;
  // user.keys.private = undefined;
  user.lastLogin = new Date();
  await user.save();

  let tokenValue = user.accessToken + ":" + Date.now();

  const token = crypto
    .publicEncrypt(user.keys.public, tokenValue)
    .toString("base64");

  user.password = undefined;
  user._id = undefined;
  return { user, token };
}
