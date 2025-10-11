import Kowloon from "#kowloon";
import { exportJWK } from "jose";
import { createHash, createPublicKey } from "crypto";

export default async function (req, res) {
  try {
    // Convert PEM string to CryptoKey
    const keyObject = createPublicKey(Kowloon.settings.publicKey);

    // Convert CryptoKey to JWK
    const jwk = await exportJWK(keyObject);

    // Annotate the JWK with key ID, algorithm, and use
    jwk.kid = createHash("sha256")
      .update(Kowloon.settings.publicKey)
      .digest("base64url");
    jwk.alg = "RS256";
    jwk.use = "sig";

    res.set("Content-Type", "application/json");
    res.set("Cache-Control", "public, max-age=3600"); // optional
    res.json({ keys: [jwk] });
  } catch (err) {
    console.error("JWKS export failed:", err);
    res.status(500).json({ error: "JWKS export failed" });
  }
}
