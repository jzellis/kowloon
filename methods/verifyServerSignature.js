// This verifies that a server's incoming request signature is valid

import crypto from "crypto";
import { User } from "../schema/index.js";
import getSettings from "./getSettings.js";

export default async function (id, timestamp, signature) {
  let settings = await getSettings();
  let serverId = `@${settings.domain}`;
  let publicKey = settings.publicKey;
  const message = id + ":" + timestamp;
  const expectedHash = crypto.createHash("sha256").update(message).digest();
  const isValid = crypto.verify(
    "sha256",
    expectedHash,
    publicKey,
    Buffer.from(signature, "base64")
  );
  if (isValid) {
    return {
      server: {
        name: settings.profile.name,
        description: settings.profile.description,
        url: `https://${settings.domain}`,
        icon: settings.profile.icon,
        location: settings.profile.location || undefined,
      },
    };
  } else {
    return { error: "Server cannot be authenticated" };
  }
}
