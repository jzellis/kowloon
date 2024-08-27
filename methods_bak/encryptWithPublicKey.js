import crypto from "crypto";

export default async function (publicKey, message) {
  const bufferMessage = Buffer.from(message, "utf8");
  return crypto.publicEncrypt(publicKey, bufferMessage);
}
