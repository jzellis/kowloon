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
  // If cache is loaded, use it
  if (isLoaded()) {
    return {
      domain: getSetting("domain"),
      actorId: getSetting("actorId"),
      privateKey: getSetting("privateKey"),
    };
  }

  // Fallback to env vars (during initialization or tests)
  logger.warn("Settings cache not loaded, using env vars as fallback");
  return {
    domain: process.env.DOMAIN,
    actorId: process.env.ACTOR_ID || `@${process.env.DOMAIN}`,
    privateKey: process.env.PRIVATE_KEY,
  };
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
  getDomain,
  getActorId,
  getSiteTitle,
  getAdminCircle,
  getModCircle,
  getSetting,
  getSettings,
};
