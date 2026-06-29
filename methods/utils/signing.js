import crypto from "crypto";
import mongoose from "mongoose";
import { getServerSettings, getSetting } from "#methods/settings/schemaHelpers.js";

export function signData(privateKey, data) {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(data);
  return sign.sign(privateKey);
}

export function verifyData(publicKey, data, signature) {
  if (!signature) return false;
  return crypto.verify("RSA-SHA256", Buffer.from(data), publicKey, signature);
}

/**
 * Sign data as a user or the server actor.
 * Returns the signature Buffer, or null if credentials are unavailable.
 */
export async function signAs(actorId, data) {
  const { actorId: serverActorId, privateKey: serverKey } = getServerSettings();
  if (actorId === serverActorId) {
    return serverKey ? signData(serverKey, data) : null;
  }
  const User = mongoose.model("User");
  const actor = await User.findOne({ id: actorId }).select("privateKey").lean();
  return actor?.privateKey ? signData(actor.privateKey, data) : null;
}

/**
 * Verify a signature produced by signAs.
 * Returns false if credentials are unavailable or the signature doesn't match.
 */
export async function verifyAs(actorId, data, signature) {
  if (!signature) return false;
  const { actorId: serverActorId } = getServerSettings();
  if (actorId === serverActorId) {
    const serverPublicKey = getSetting("publicKey");
    return serverPublicKey ? verifyData(serverPublicKey, data, signature) : false;
  }
  const User = mongoose.model("User");
  const actor = await User.findOne({ id: actorId }).select("publicKey").lean();
  return actor?.publicKey ? verifyData(actor.publicKey, data, signature) : false;
}
