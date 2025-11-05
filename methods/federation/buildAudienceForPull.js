// /methods/federation/buildAudienceForPull.js
// Build LOCAL audience list for /outbox/pull request to remote server
// Returns array of local user IDs who follow actors on the given domain

import { Circle, User, Server } from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

/**
 * Build audience list for a pull request to a remote server
 * @param {Object} options
 * @param {string} options.domain - Remote domain
 * @param {string[]} options.actors - Remote actor IDs we're interested in
 * @param {number} [options.maxAudience=5000] - Cap audience size
 * @returns {Promise<string[]>} Array of local user IDs
 */
export default async function buildAudienceForPull({
  domain,
  actors = [],
  maxAudience = 5000,
}) {
  const { domain: localDomain } = getServerSettings();
  const audienceSet = new Set();

  // 1. Find all local users who follow any of the remote actors
  if (actors.length > 0) {
    // Query Following circles that contain any of the remote actors as members
    const followingCircles = await Circle.find({
      subtype: "Following",
      "members.id": { $in: actors },
    })
      .select("owner.id")
      .lean();

    for (const circle of followingCircles) {
      if (circle.owner?.id) {
        audienceSet.add(circle.owner.id);
      }
    }
  }

  // 2. Add local users who follow the server itself (@domain)
  const serverFollow = `@${domain}`;
  const serverFollowingCircles = await Circle.find({
    subtype: "Following",
    "members.id": serverFollow,
  })
    .select("owner.id")
    .lean();

  for (const circle of serverFollowingCircles) {
    if (circle.owner?.id) {
      audienceSet.add(circle.owner.id);
    }
  }

  // 3. Convert to array and cap
  let audience = Array.from(audienceSet);

  // Sort for consistency (important for hashing)
  audience.sort();

  // Cap to maxAudience
  if (audience.length > maxAudience) {
    audience = audience.slice(0, maxAudience);
  }

  return audience;
}
