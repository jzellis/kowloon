import { access } from "fs";
import { Circle, User } from "../schema/index.js";
import crypto from "crypto";
export default async function (username, password = "") {
  let user = await User.findOne({ username }).select("-keys.private");

  if (!user) return false;
  if (!(await user.verifyPassword(password))) return false;
  // user.keys.private = undefined;
  user.lastLogin = new Date();
  await user.save();
  let tokenValue = user.accessToken + ":" + Date.now();

  const token = crypto
    .publicEncrypt(user.keys.public, tokenValue)
    .toString("base64");
  return {
    user: {
      ...user._doc,
      password: undefined,
      _id: undefined,
      flagged: undefined,
      accessToken: undefined,
      circles: await Circle.find({ actorId: user.id, deletedAt: null })
        .lean()
        .sort({ createdAt: -1 })
        .select("-_id -__v -deletedAt"),
    },
    token,
  };
}
