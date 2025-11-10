// /routes/well-known/kowloon.js
// Kowloon server metadata endpoint
// Returns server info including public key for federation

import route from "../utils/route.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import { getSetting } from "#methods/settings/cache.js";

export default route(async ({ set }) => {
  const { domain } = getServerSettings();
  const publicKey = getSetting("publicKey");

  if (!publicKey) {
    throw new Error("Server public key not configured");
  }

  // Return server metadata
  set({
    id: `@${domain}`,
    domain,
    type: "KowloonServer",
    version: "1.0",
    publicKey, // RSA public key in PEM format
    endpoints: {
      pull: `https://${domain}/federation/pull`,
      inbox: `https://${domain}/inbox`,
      outbox: `https://${domain}/outbox`,
    },
    support: {
      signedPull: true,
      compression: ["gzip", "br"],
      cursors: true,
    },
  });
}, { allowUnauth: true });
