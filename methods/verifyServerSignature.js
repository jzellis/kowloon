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
        name: settings.title,
        description: settings.description,
        url: `https://${settings.domain}`,
        icon: settings.icon,
        location: settings.location || undefined,
      },
    };
  } else {
    return { error: "Server cannot be authenticated" };
  }
}
