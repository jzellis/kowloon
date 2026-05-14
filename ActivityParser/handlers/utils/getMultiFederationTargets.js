// /ActivityParser/handlers/utils/getMultiFederationTargets.js
//
// On-demand federation model: an Activity may need to land on several remote
// servers to keep all interested parties consistent.
//
//   - The CANONICAL host for the target object (where authoritative state lives —
//     e.g., for a React on a Reply, the parent post's host)
//   - The TARGET's author's home (so they get the notification side-effect their
//     server creates when its handler runs the activity)
//   - Any other relevant party (caller decides)
//
// Pass any combination of Kowloon IDs (Post/Reply/React/User/etc.). Each id is
// parsed for its domain; the local domain is filtered out; duplicates are
// deduped. If no remote domains remain, returns shouldFederate: false.

import kowloonId from "#methods/parse/kowloonId.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

export default function getMultiFederationTargets(...ids) {
  const { domain: serverDomain } = getServerSettings();
  const localDomain = serverDomain?.toLowerCase();

  const domains = new Set();
  for (const id of ids) {
    if (!id || typeof id !== "string") continue;
    const d = kowloonId(id).domain?.toLowerCase();
    if (d && d !== localDomain) domains.add(d);
  }

  if (domains.size === 0) return { shouldFederate: false };

  return {
    shouldFederate: true,
    scope: "domain",
    domains: [...domains],
  };
}
