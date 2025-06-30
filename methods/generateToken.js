import getSettings from "./getSettings.js";
import { Circle, User } from "../schema/index.js";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";

export default async function (actorId) {
  const settings = await getSettings();
  const user = await User.findOne({ id: actorId }).select(
    "id username profile following blocked muted lastLogin"
  );

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
        following: user.following,
        lastLogin: user.lastLogin,
        feedRefreshedAt: user.feedRefreshedAt,
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
