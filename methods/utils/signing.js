import crypto from "crypto";

export function signData(privateKey, data) {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(data);
  return sign.sign(privateKey);
}

export function verifyData(publicKey, data, signature) {
  if (!signature) return false;
  return crypto.verify("RSA-SHA256", Buffer.from(data), publicKey, signature);
}
