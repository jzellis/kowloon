// This authorizes a user's request to the server. Arguments are the user's ID, their login timestamp, and their signature.

import { Circle, User } from "../schema/index.js";
import crypto from "crypto";
import getSettings from "./getSettings.js";
import verifyUserSignature from "./verifyUserSignature.js";
export default async function (id, timestamp, signature) {
  if (!id) return { error: "No ID provided" };
  if (!timestamp) return { error: "No timestamp provided" };
  if (!signature) return { error: "No signature provided" };
  let user = await verifyUserSignature(id, timestamp, signature);
  return { user } || { error: "User not authenticated" };
}
