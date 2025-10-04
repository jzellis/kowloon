import crypto from "crypto";

async function verifyS2S(req) {
  const clientId = req.get("X-Client-Id");
  const timestamp = req.get("X-Timestamp");
  const signature = req.get("X-Signature");
  if (!clientId || !timestamp || !signature) return null;

  // 5 min replay window
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return null;

  const method = req.method.toUpperCase();
  const path = req.originalUrl.split("?")[0];
  const body = req.rawBody || ""; // ensure raw body capture middleware
  const bodyHex = crypto.createHash("sha256").update(body).digest("hex");
  const toSign = `${method}\n${path}\n${timestamp}\n${bodyHex}`;

  const secret = await Kowloon.getPeerSecret(clientId); // your lookup
  if (!secret) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(toSign)
    .digest("hex");
  const ok = crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
  return ok ? { clientId } : null;
}

export default verifyS2S;
