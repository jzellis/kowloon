// Login function, just takes a username or ID and password
import getSettings from "./getSettings.js";
import { Circle, User } from "../schema/index.js";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";

export default async function (username, password = "") {
  let settings = await getSettings();
  let user = await User.findOne({
    $or: [{ username: username }, { id: username }],
  }).select("id username password profile blocked muted");

  if (!user) return { error: "User not found" };
  if (!(await user.verifyPassword(password))) {
    console.log("Incorrect password");
    return { error: "Incorrect password" };
  }
  user.lastLogin = new Date();
  await user.save();
  let blocked = (
    await Circle.findOne({ id: user.blocked }).select("members")
  ).members.map((m) => m.id);
  let muted = (
    await Circle.findOne({ id: user.muted }).select("members")
  ).members.map((m) => m.id);
  let token = jwt.sign(
    {
      user: {
        id: user.id,
        username: user.username,
        profile: user.profile,
        muted: muted,
        blocked: blocked,
      },
      loggedIn: user.lastLogin,
    },
    settings.privateKey,
    {
      algorithm: "RS256",
      issuer: `https://${process.env.KOWLOON_DOMAIN}`,
      keyid: createHash("sha256")
        .update(settings.publicKey)
        .digest("base64url"),
    }
  );

  return token;
}
