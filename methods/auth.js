import { Circle, User } from "../schema/index.js";
import crypto from "crypto";
import getSettings from "./getSettings.js";
import isLocal from "./isLocal.js";
export default async function (id, token) {
  if (!id) return { error: "No ID provided" };
  if (!token) return { error: "No token provided" };
  let server = (await getSettings()).domain;
  token = token.split("Basic ")[1];
  if (await isLocal(id)) {
    let user = await User.findOne({ id });
    let decrypted;

    if (user) {
      try {
        decrypted = crypto
          .privateDecrypt(user.keys.private, Buffer.from(token, "base64"))
          .toString("utf-8")
          .split(":")[0];
        if (decrypted === user.accessToken)
          return {
            user: {
              ...user._doc,
              password: undefined,
              accessToken: undefined,
              _id: undefined,
              __v: undefined,

              keys: {
                public: user._doc.keys.public,
              },
              circles: await Circle.find({ actorId: user.id, deletedAt: null })
                .lean()
                .sort({ createdAt: -1 })
                .select("-_id -__v -deletedAt"),
            },
          };
      } catch (e) {
        return { error: "Verification failed, token invalid" };
      }
    } else {
      return { error: "User not found" };
    }
  } else {
    try {
      let json = await (
        await fetch(`https://${server}/api/auth`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${token}`,
            "kowloon-id": id,
          },
        })
      ).json();
      if (json.error) return { error: json.error };
      return json;
    } catch (e) {
      return { error: "Remote server verification failed" };
    }
  }
}
