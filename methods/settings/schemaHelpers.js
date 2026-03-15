// /methods/settings/schemaHelpers.js
// Helper functions for schema pre-save hooks to get settings without DB queries

import { getSetting, getSettings, isLoaded } from "./cache.js";
import logger from "#methods/utils/logger.js";

/**
 * Get domain and actorId settings commonly needed in schema pre-save hooks
 * Falls back to environment variables if cache isn't loaded yet
 *
 * @returns {Object} { domain, actorId, privateKey }
 */
export function getServerSettings() {
  const domain = (isLoaded() ? getSetting("domain") : null) || process.env.DOMAIN || null;
  const actorId =
    (isLoaded() ? getSetting("actorId") : null) ||
    process.env.ACTOR_ID ||
    (domain ? `https://${domain}/server` : null);
  const privateKey = (isLoaded() ? getSetting("privateKey") : null) || process.env.PRIVATE_KEY || null;

  if (!isLoaded()) logger.warn("Settings cache not loaded, using env vars as fallback");

  return { domain, actorId, privateKey };
}

/**
 * Get domain setting
 * @returns {string|null}
 */
export function getDomain() {
  if (isLoaded()) {
    return getSetting("domain");
  }
  return process.env.DOMAIN || null;
}

/**
 * Get actorId (server actor) setting
 * @returns {string|null}
 */
export function getActorId() {
  if (isLoaded()) {
    return getSetting("actorId");
  }
  return (
    process.env.ACTOR_ID ||
    (process.env.DOMAIN ? `https://${process.env.DOMAIN}/server` : null)
  );
}

/**
 * Build the server's AP actor object from current settings.
 * Always derives from live settings cache — no DB lookup, no stored copy.
 * Shape matches sanitizeUser output so resolve/verify work identically.
 * @returns {Object|null}
 */
export function getServerActor() {
  const domain = getDomain();
  if (!domain) return null;
  const profile = getSetting("profile");
  const actorUrl = `https://${domain}/users/@${domain}`;
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: actorUrl,
    type: "Application",
    objectType: "User",
    preferredUsername: `@${domain}`,
    name: profile?.name || domain,
    summary: profile?.description || null,
    icon: profile?.icon || null,
    url: `https://${domain}`,
    inbox: `https://${domain}/inbox`,
    outbox: `https://${domain}/outbox`,
    publicKey: getSetting("publicKey"),
  };
}

/**
 * Get site title setting
 * @returns {string}
 */
export function getSiteTitle() {
  return getSetting("siteTitle", "Kowloon");
}

/**
 * Get admin circle ID
 * @returns {string|null}
 */
export function getAdminCircle() {
  return getSetting("adminCircle");
}

/**
 * Get moderator circle ID
 * @returns {string|null}
 */
export function getModCircle() {
  return getSetting("modCircle");
}

// Re-export getSetting for convenience
export { getSetting, getSettings };

export default {
  getServerSettings,
  getServerActor,
  getDomain,
  getActorId,
  getSiteTitle,
  getAdminCircle,
  getModCircle,
  getSetting,
  getSettings,
};
