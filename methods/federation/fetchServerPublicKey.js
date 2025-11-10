// /methods/federation/fetchServerPublicKey.js
// Fetch and store a remote server's public key

import fetch from "node-fetch";
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
 * Fetch a remote server's public key and store it in the Server record
 * @param {string} domain - Remote server domain (e.g., "kwln.social")
 * @returns {Promise<string>} Public key in PEM format
 */
export default async function fetchServerPublicKey(domain) {
  domain = normalizeDomain(domain);

  // Try to fetch from /.well-known/kowloon endpoint
  const wellKnownUrl = `https://${domain}/.well-known/kowloon`;

  try {
    const response = await fetch(wellKnownUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      timeout: 10000,
    });

    if (response.status !== 200) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.publicKey) {
      throw new Error("No publicKey field in response");
    }

    // Store the public key in the Server record
    await Server.updateOne(
      { domain },
      {
        $set: {
          publicKey: data.publicKey,
        },
      },
      { upsert: true }
    );

    console.log(`Fetched and stored public key for ${domain}`);
    return data.publicKey;
  } catch (err) {
    console.error(`Failed to fetch public key for ${domain}:`, err.message);
    throw new Error(`Could not fetch public key from ${domain}: ${err.message}`);
  }
}
