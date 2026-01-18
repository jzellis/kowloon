// /methods/core/getCircle.js
// Get a Circle (if visible to current user)

import objectById from "#methods/get/objectById.js";

/**
 * Get a Circle
 * @param {string} id - Circle ID (circle:uuid@domain)
 * @param {Object} opts - Options
 * @param {string} opts.viewerId - Viewing user ID (for ACL)
 * @param {boolean} opts.allowRemote - Allow fetching from remote servers (default: true)
 * @param {number} opts.maxStaleSeconds - Use cached version if fresher than this (default: 300)
 * @returns {Promise<Object>} - circle(id, server, actorId, name, description, members, to, createdAt, updatedAt, memberCount, url)
 */
export default async function getCircle(id, {
  viewerId = null,
  allowRemote = true,
  maxStaleSeconds = 300,
} = {}) {
  const mode = allowRemote ? "prefer-local" : "local";

  const result = await objectById(id, {
    viewerId,
    mode,
    maxStaleSeconds,
    enforceLocalVisibility: true,
    hydrateRemoteIntoDB: true,
  });

  return result.object;
}
