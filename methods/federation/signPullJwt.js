// /methods/federation/signPullJwt.js
// Sign a short-lived JWT for authenticated /outbox/pull requests

import { webcrypto } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

// Ensure crypto is available globally for jose
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

/**
 * Sign a JWT for federation pull request
 * @param {Object} options
 * @param {string} options.aud - Audience (remote domain URL, e.g., "https://kwln.org")
 * @param {string} [options.scope="federation:pull"] - Scope claim
 * @param {number} [options.expiresIn=60] - Expiration in seconds
 * @returns {Promise<string>} Signed JWT
 */
export default async function signPullJwt({
  aud,
  scope = "federation:pull",
  expiresIn = 60,
}) {
  const { domain, actorId, privateKey } = getServerSettings();

  if (!privateKey) {
    throw new Error("Private key not available for JWT signing");
  }

  const iss = `https://${domain}`;
  const now = Math.floor(Date.now() / 1000);

  // Import private key from PEM
  const key = await importPKCS8(privateKey, "RS256");

  // Sign JWT
  const jwt = await new SignJWT({
    scope,
    iss,
    sub: actorId || iss, // server actor ID or server URL
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .setAudience(aud)
    .setIssuer(iss)
    .sign(key);

  return jwt;
}
