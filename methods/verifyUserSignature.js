// This verifies that a user's incoming request signature is valid

import crypto from "crypto";
import { User } from "../schema/index.js";

export default async function (id, timestamp, signature) {
  let user = await User.findOne({ id });
  if (!user) return { error: "User not found" };
  const token = id + ":" + timestamp;
  const hash = crypto.createHash("sha256").update(token).digest();
  const isValid = crypto.verify(
    "sha256",
    hash,
    user.publicKey,
    Buffer.from(signature, "base64")
  );
  if (isValid) {
    return isValid;
  } else {
    return { error: "User cannot be authenticated" };
  }
}
