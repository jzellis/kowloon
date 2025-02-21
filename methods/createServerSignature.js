import crypto from "crypto";
import { User } from "../schema/index.js";
import getSettings from "./getSettings.js";

export default async function () {
  let settings = await getSettings();
  let id = `@${settings.domain}`;
  let privateKey = settings.privateKey;
  let timestamp = Math.floor(Date.now() / 1000);
  let token = id + ":" + timestamp;
  let hash = crypto.createHash("sha256").update(token).digest();
  const signature = crypto.sign("sha256", hash, privateKey).toString("base64");
  return { id, timestamp, signature };
}
