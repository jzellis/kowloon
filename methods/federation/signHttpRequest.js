// /methods/federation/signHttpRequest.js
// Creates HTTP signature for outbound federation requests

import crypto from "crypto";
import { User } from "#schema";
import { getSetting } from "#methods/settings/cache.js";
import log from "#methods/utils/logger.js";

/**
 * Get server actor (the @domain user with keys)
 * @returns {Promise<Object|null>} The server actor user object
 */
async function getServerActor() {
  const domain = getSetting("domain") || process.env.DOMAIN;
  if (!domain) {
    log.error("Cannot get server actor: no domain configured");
    return null;
  }

  const serverActorId = `@${domain}`;
  const serverActor = await User.findOne({ id: serverActorId }).lean();

  if (!serverActor || !serverActor.privateKey) {
    log.error("Server actor not found or has no private key", {
      serverActorId,
    });
    return null;
  }

  return serverActor;
}

/**
 * Build signing string from request components
 * @param {string} method - HTTP method (e.g., 'post')
 * @param {string} path - Request path (e.g., '/inbox')
 * @param {Object} headers - Headers to include in signature
 * @param {Array<string>} headersList - List of headers to sign
 * @returns {string} The signing string
 */
function buildSigningString(method, path, headers, headersList) {
  const lines = [];

  for (const h of headersList) {
    if (h === "(request-target)") {
      lines.push(`(request-target): ${method.toLowerCase()} ${path}`);
    } else {
      const val = headers[h.toLowerCase()];
      if (!val) {
        throw new Error(`Missing required header for signing: ${h}`);
      }
      lines.push(`${h.toLowerCase()}: ${val}`);
    }
  }

  return lines.join("\n");
}

/**
 * Create HTTP signature for a request
 * @param {Object} options
 * @param {string} options.method - HTTP method ('POST', 'GET', etc.)
 * @param {string} options.url - Full URL being requested
 * @param {Object} options.headers - Headers object (will be mutated)
 * @param {string|Object} options.body - Request body
 * @returns {Promise<Object>} Updated headers with Signature and Digest
 */
export default async function signHttpRequest({
  method,
  url,
  headers = {},
  body = "",
}) {
  // Get server actor with private key
  const serverActor = await getServerActor();
  if (!serverActor) {
    throw new Error("Server actor not available for signing");
  }

  // Parse URL
  const parsedUrl = new URL(url);
  const path = parsedUrl.pathname + parsedUrl.search;
  const host = parsedUrl.host;

  // Build body string if needed
  let bodyStr = "";
  if (body) {
    if (typeof body === "string") {
      bodyStr = body;
    } else if (Buffer.isBuffer(body)) {
      bodyStr = body.toString("utf8");
    } else if (typeof body === "object") {
      bodyStr = JSON.stringify(body);
    }
  }

  // Generate digest header (SHA-256 of body)
  const digest = crypto
    .createHash("sha256")
    .update(bodyStr || "")
    .digest("base64");

  // Prepare headers for signing
  const now = new Date().toUTCString();
  const signHeaders = {
    host,
    date: now,
    digest: `SHA-256=${digest}`,
    "content-type": "application/activity+json",
  };

  // Add to provided headers
  Object.assign(headers, signHeaders);

  // Build signing string
  const headersList = ["(request-target)", "host", "date", "digest"];
  const signingString = buildSigningString(method, path, headers, headersList);

  // Sign with server's private key
  const sign = crypto.createSign("SHA256");
  sign.update(signingString);
  sign.end();
  const signature = sign.sign(serverActor.privateKey, "base64");

  // Build signature header
  const domain = getSetting("domain") || process.env.DOMAIN;
  const keyId = `https://${domain}/users/@${domain}#main-key`;
  const signatureHeader = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${headersList.join(" ")}"`,
    `signature="${signature}"`,
  ].join(",");

  // Add Signature header
  headers.signature = signatureHeader;

  log.debug("HTTP signature created", {
    method,
    url,
    keyId,
    headers: headersList,
  });

  return {
    headers,
    keyId,
    signingString,
  };
}
