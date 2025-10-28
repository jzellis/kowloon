import getObjectById from "#methods/get/objectById.js";
import { User } from "#schema";
import { getSetting } from "#methods/settings/cache.js";

// Extract domain from various ID formats
function extractDomain(id) {
  if (!id || typeof id !== "string") return null;
  const at = id.lastIndexOf("@");
  if (at !== -1 && at < id.length - 1) {
    return id.slice(at + 1).toLowerCase();
  }
  try {
    return new URL(id).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export default async function (activity) {
  // Flag activity federates only when flagging remote content to its host moderators
  const localDomain = getSetting("domain") || process.env.DOMAIN;
  const flaggedObjectId = activity.object?.id || activity.object;

  if (flaggedObjectId && localDomain) {
    const objectDomain = extractDomain(flaggedObjectId);
    if (objectDomain && objectDomain !== localDomain.toLowerCase()) {
      activity.federate = true;
    }
  }

  return activity;
}
