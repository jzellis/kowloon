// /methods/federation/pullForUser.js
// Pull fresh content from remote servers for a specific user

import { Circle, Server } from "#schema";
import pullFromServer from "./pullFromServer.js";

/**
 * Normalize domain
 */
function normalizeDomain(domain) {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/:\d+$/, "");
}

/**
 * Pull content from remote servers for a specific user
 * Pulls from all servers where this user follows actors
 *
 * @param {string} userId - Local user ID (e.g., "@alice@kwln.org")
 * @param {Object} options - Pull options
 * @param {number} [options.limit] - Max items per server (default: 50)
 * @returns {Promise<Object>} Summary of pulls executed
 */
export default async function pullForUser(userId, options = {}) {
  const limit = options.limit || 50;

  console.log(`Pull for user: ${userId}`);

  // Find all Following circles for this user
  const followingCircles = await Circle.find({
    "owner.id": userId,
    subtype: "Following",
  }).select("members.id");

  if (!followingCircles || followingCircles.length === 0) {
    console.log(`No following relationships found for ${userId}`);
    return {
      userId,
      serversPolled: 0,
      totalIngested: 0,
      errors: [],
    };
  }

  // Collect all remote actor IDs this user follows
  const remoteActors = [];
  for (const circle of followingCircles) {
    for (const member of circle.members || []) {
      if (member.id && member.id !== userId) {
        remoteActors.push(member.id);
      }
    }
  }

  if (remoteActors.length === 0) {
    console.log(`User ${userId} doesn't follow any actors`);
    return {
      userId,
      serversPolled: 0,
      totalIngested: 0,
      errors: [],
    };
  }

  console.log(`User ${userId} follows ${remoteActors.length} actors`);

  // Group actors by domain
  const actorsByDomain = new Map();
  for (const actorId of remoteActors) {
    const domain = normalizeDomain(actorId.split("@").pop());
    if (!actorsByDomain.has(domain)) {
      actorsByDomain.set(domain, []);
    }
    actorsByDomain.get(domain).push(actorId);
  }

  console.log(`Pulling from ${actorsByDomain.size} remote servers`);

  // Pull from each remote server
  const results = [];
  const errors = [];
  let totalIngested = 0;

  for (const [domain, actors] of actorsByDomain.entries()) {
    try {
      console.log(`Pulling from ${domain} (${actors.length} actors)`);

      const result = await pullFromServer(domain, {
        limit,
        actors,
        audience: [userId], // Only pull content for this user
      });

      if (result.error) {
        errors.push({
          domain,
          error: result.error,
          status: result.status,
        });
      } else {
        const ingested = result.result?.ingested || 0;
        totalIngested += ingested;
        results.push({
          domain,
          actors: actors.length,
          ingested,
        });
        console.log(`  ✓ ${domain}: ingested ${ingested} items`);
      }
    } catch (err) {
      errors.push({
        domain,
        error: err.message,
      });
      console.error(`  ✗ ${domain}: ${err.message}`);
    }
  }

  return {
    userId,
    serversPolled: actorsByDomain.size,
    totalIngested,
    results,
    errors: errors.length > 0 ? errors : undefined,
  };
}
