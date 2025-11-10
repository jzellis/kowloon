// /methods/federation/verifyPullJwt.js
// Verify JWT from remote server making a pull request

import { jwtVerify, importSPKI } from "jose";
import { Server } from "#schema";

/**
 * Normalize domain to lowercase, remove scheme/port
 */
function normalizeDomain(domain) {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/:\d+$/, "");
}

/**
 * Fetch public key for a remote server
 * @param {string} domain - Remote server domain
 * @returns {Promise<string>} Public key in PEM format
 */
async function getServerPublicKey(domain) {
  // First, check if we have the server registered
  const server = await Server.findOne({ domain: normalizeDomain(domain) });

  if (server?.publicKey) {
    return server.publicKey;
  }

  // If not in DB, could fetch from /.well-known/kowloon or actor endpoint
  // For now, return null if not registered
  throw new Error(`Public key not found for server ${domain}`);
}

/**
 * Verify a JWT from a remote server's pull request
 * @param {string} token - JWT token from Authorization header
 * @param {string} expectedAudience - Our domain (the audience claim we expect)
 * @returns {Promise<Object>} Decoded and verified JWT payload with server info
 */
export default async function verifyPullJwt(token, expectedAudience) {
  if (!token) {
    throw new Error("No token provided");
  }

  // Decode the token header to get the issuer
  // We need to know which server sent it to fetch the right public key
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  // Decode payload to get issuer
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  if (!payload.iss) {
    throw new Error("JWT missing issuer (iss) claim");
  }

  const issuerDomain = normalizeDomain(payload.iss);

  // Get the public key for this server
  const publicKeyPem = await getServerPublicKey(issuerDomain);

  // Import the public key
  const publicKey = await importSPKI(publicKeyPem, "RS256");

  // Verify the JWT
  const { payload: verified } = await jwtVerify(token, publicKey, {
    issuer: payload.iss, // Must match the issuer
    audience: expectedAudience, // Must be our domain
    algorithms: ["RS256"],
  });

  // Check scope
  if (verified.scope !== "federation:pull") {
    throw new Error("Invalid scope in JWT");
  }

  // Check expiration (jose does this automatically, but we can add custom checks)
  const now = Math.floor(Date.now() / 1000);
  if (verified.exp && verified.exp < now) {
    throw new Error("JWT has expired");
  }

  // Return verified payload with server domain
  return {
    domain: issuerDomain,
    payload: verified,
  };
}
