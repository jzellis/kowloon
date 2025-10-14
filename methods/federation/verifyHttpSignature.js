// /methods/federation/verifyHttpSignature.js
import crypto from "crypto";
import fetch from "node-fetch";
import logger from "#methods/utils/logger.js";

function parseSignatureHeader(sig) {
  // e.g. keyId="...",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="base64..."
  const out = {};
  for (const part of String(sig || "").split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (!k || !v) continue;
    out[k] = v.replace(/^"|"$/g, "");
  }
  return out;
}

function buildSigningString(req, headersList) {
  const method = req.method.toLowerCase();
  const path = req.originalUrl || req.url || "/";
  const lines = [];

  for (const h of headersList) {
    if (h === "(request-target)") {
      lines.push(`(request-target): ${method} ${path}`);
    } else {
      const val = req.get(h);
      if (!val) throw new Error(`missing signed header: ${h}`);
      lines.push(`${h.toLowerCase()}: ${val}`);
    }
  }
  return lines.join("\n");
}

async function fetchPublicKeyFromKeyId(keyId) {
  // Commonly a URL (actor or server key). Fetch it, parse JSON, extract PEM/JWK.
  // You can extend this to cache in Redis/Mongo.
  try {
    const res = await fetch(keyId, { method: "GET", timeout: 5000 });
    if (!res.ok) throw new Error(`key fetch ${res.status}`);
    const json = await res.json();
    // Try common shapes: {publicKeyPem} or {publicKey: {publicKeyPem}} or JWKS
    const pem = json?.publicKey?.publicKeyPem || json?.publicKeyPem;
    if (pem) return { type: "pem", key: pem };
    // JWKS (choose first RSA key)
    if (json?.keys?.length) return { type: "jwks", jwks: json };
  } catch (e) {
    logger.warn("verifyHttpSignature: key fetch error", {
      keyId,
      error: e.message,
    });
  }
  throw new Error("unable to resolve key");
}

function verifyWithPem(pem, algo, data, sigB64) {
  const verifier = crypto.createVerify(algo || "RSA-SHA256");
  verifier.update(data);
  verifier.end();
  return verifier.verify(pem, Buffer.from(sigB64, "base64"));
}

export default async function verifyHttpSignature(
  req,
  { maxSkewMs = 5 * 60 * 1000 } = {}
) {
  const sigHeader = req.get("Signature");
  if (!sigHeader) return { ok: false, error: "Missing Signature header" };

  const { keyId, algorithm, headers, signature } =
    parseSignatureHeader(sigHeader);
  if (!keyId || !signature)
    return { ok: false, error: "Invalid Signature header" };

  // Required headers we expect to be signed
  const headersList = (headers || "(request-target) host date digest")
    .split(/\s+/)
    .filter(Boolean);

  // Basic freshness checks
  const date = req.get("Date");
  if (!date) return { ok: false, error: "Missing Date header" };
  const skew = Math.abs(Date.now() - Date.parse(date));
  if (isFinite(skew) && skew > maxSkewMs)
    return { ok: false, error: "Clock skew too large" };

  // If a body exists and Digest header is present, you may verify it here as well.

  // Build the signing string
  let signingString;
  try {
    signingString = buildSigningString(req, headersList);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  // Resolve key + verify
  let keyInfo;
  try {
    keyInfo = await fetchPublicKeyFromKeyId(keyId);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  let ok = false;
  if (keyInfo.type === "pem") {
    ok = verifyWithPem(
      keyInfo.key,
      (algorithm || "rsa-sha256").toUpperCase(),
      signingString,
      signature
    );
  } else {
    // TODO: implement JWKS verify if needed (map algo to node verifier)
    return {
      ok: false,
      error: "JWKS verification not implemented in this stub",
    };
  }

  if (!ok) return { ok: false, error: "Invalid HTTP Signature" };

  // Extract domain from Host
  const host = req.get("Host") || "";
  const domain = host.replace(/:\d+$/, "");

  return { ok: true, domain, keyId };
}
