// /methods/federation/resolveAudience.js
// Resolves activity recipients to concrete inbox URLs for outbound federation

import { getSetting } from "#methods/settings/cache.js";
import getObjectById from "#methods/core/getObjectById.js";
import log from "#methods/utils/logger.js";

/**
 * Extract domain from various ID formats
 * @param {string} id - Could be @user@domain, group:id@domain, or https://domain/...
 * @returns {string|null} The domain, or null
 */
function extractDomain(id) {
  if (!id || typeof id !== "string") return null;

  // Handle @user@domain or group:id@domain format
  const at = id.lastIndexOf("@");
  if (at !== -1 && at < id.length - 1) {
    return id.slice(at + 1).toLowerCase();
  }

  // Handle URL format
  try {
    return new URL(id).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check if an ID belongs to the local server
 * @param {string} id - The ID to check
 * @param {string} localDomain - This server's domain
 * @returns {boolean}
 */
function isLocal(id, localDomain) {
  if (!id || !localDomain) return false;
  const domain = extractDomain(id);
  return domain === localDomain.toLowerCase();
}

/**
 * Resolve an actorId to its inbox URL
 * @param {string} actorId - The actor ID to resolve
 * @returns {Promise<string|null>} The inbox URL, or null if not resolvable
 */
async function resolveInbox(actorId) {
  if (!actorId || typeof actorId !== "string") return null;

  try {
    // Try to fetch the actor object
    const actor = await getObjectById(actorId);
    if (!actor) return null;

    // Check for inbox field
    if (actor.inbox && typeof actor.inbox === "string") {
      // Validate it's an HTTPS URL
      try {
        const url = new URL(actor.inbox);
        if (url.protocol === "https:") {
          return actor.inbox;
        }
      } catch {
        // Invalid URL
      }
    }

    // Try to construct inbox URL from actorId if it's a URL
    try {
      const actorUrl = new URL(actorId);
      if (actorUrl.protocol === "https:") {
        // Try common inbox patterns
        const baseUrl = `${actorUrl.protocol}//${actorUrl.host}`;
        const username = actorUrl.pathname.split("/").filter(Boolean).pop();
        if (username) {
          return `${baseUrl}/users/${username}/inbox`;
        }
      }
    } catch {
      // Not a URL
    }

    return null;
  } catch (err) {
    log.warn("Failed to resolve inbox for actor", {
      actorId,
      error: err.message,
    });
    return null;
  }
}

/**
 * Extract recipient IDs from an activity
 * @param {Object} activity - The activity to extract recipients from
 * @returns {Set<string>} Set of recipient IDs
 */
function extractRecipients(activity) {
  const recipients = new Set();

  // Helper to add recipient
  const add = (id) => {
    if (id && typeof id === "string" && id !== "@public") {
      recipients.add(id);
    }
  };

  // Extract from top-level fields
  add(activity.to);
  add(activity.target);

  // Extract from object if present
  if (activity.object && typeof activity.object === "object") {
    add(activity.object.to);
    add(activity.object.target);
    add(activity.object.inReplyTo);
    add(activity.object.targetActorId);
  }

  return recipients;
}

/**
 * Resolve activity audience to concrete inbox URLs
 * @param {Object} activity - The activity to resolve recipients for
 * @returns {Promise<Array<{target: string, inboxUrl: string, host: string}>>}
 */
export default async function resolveAudience(activity) {
  const localDomain = getSetting("domain") || process.env.DOMAIN;
  if (!localDomain) {
    log.error("Cannot resolve audience: no domain configured");
    return [];
  }

  // Extract all potential recipients
  const recipientIds = extractRecipients(activity);

  // Filter out local recipients
  const remoteRecipients = Array.from(recipientIds).filter(
    (id) => !isLocal(id, localDomain)
  );

  if (remoteRecipients.length === 0) {
    return [];
  }

  // Resolve each recipient to an inbox URL
  const resolvedPromises = remoteRecipients.map(async (actorId) => {
    const inboxUrl = await resolveInbox(actorId);
    if (!inboxUrl) return null;

    const host = extractDomain(inboxUrl);
    if (!host) return null;

    return {
      target: actorId,
      inboxUrl,
      host,
    };
  });

  const resolved = await Promise.all(resolvedPromises);

  // Filter out nulls and dedupe by inboxUrl
  const seen = new Set();
  const unique = resolved.filter((item) => {
    if (!item) return false;
    if (seen.has(item.inboxUrl)) return false;
    seen.add(item.inboxUrl);
    return true;
  });

  log.info("Resolved audience", {
    activityType: activity.type,
    totalRecipients: recipientIds.size,
    remoteRecipients: remoteRecipients.length,
    resolvedInboxes: unique.length,
  });

  return unique;
}
