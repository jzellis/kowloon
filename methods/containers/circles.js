// /methods/containers/circles.js
// Clean utilities for Circle operations

import { Circle } from "#schema";

/**
 * Get all members of a Circle
 * @param {string} circleId - Circle ID
 * @returns {Promise<Array<{id: string, name?: string, icon?: string}>>}
 */
export async function getMembers(circleId) {
  if (!circleId) return [];

  const circle = await Circle.findOne({ id: circleId })
    .select("members")
    .lean();

  if (!circle?.members) return [];

  return circle.members.filter(m => m?.id);
}

/**
 * Get all member IDs from a Circle (just the IDs, no metadata)
 * @param {string} circleId - Circle ID
 * @returns {Promise<string[]>}
 */
export async function getMemberIds(circleId) {
  const members = await getMembers(circleId);
  return members.map(m => m.id);
}

/**
 * Get unique server domains from Circle members
 * @param {string} circleId - Circle ID
 * @returns {Promise<string[]>} - Array of unique domain strings
 */
export async function getServerDomains(circleId) {
  const members = await getMembers(circleId);
  const domains = new Set();

  for (const member of members) {
    const domain = extractDomain(member.id);
    if (domain) domains.add(domain);
  }

  return Array.from(domains);
}

/**
 * Group Circle members by their server domain
 * @param {string} circleId - Circle ID
 * @returns {Promise<Map<string, string[]>>} - Map of domain -> member IDs
 */
export async function getMembersByDomain(circleId) {
  const members = await getMembers(circleId);
  const byDomain = new Map();

  for (const member of members) {
    const domain = extractDomain(member.id);
    if (!domain) continue;

    if (!byDomain.has(domain)) {
      byDomain.set(domain, []);
    }
    byDomain.get(domain).push(member.id);
  }

  return byDomain;
}

/**
 * Separate Circle members into local vs remote
 * @param {string} circleId - Circle ID
 * @param {string} localDomain - The local server domain
 * @returns {Promise<{local: string[], remote: string[]}>}
 */
export async function partitionMembers(circleId, localDomain) {
  const members = await getMemberIds(circleId);
  const local = [];
  const remote = [];

  const localSuffix = `@${localDomain.toLowerCase()}`;

  for (const id of members) {
    if (id.toLowerCase().endsWith(localSuffix)) {
      local.push(id);
    } else {
      remote.push(id);
    }
  }

  return { local, remote };
}

/**
 * Check if a user is a member of a Circle
 * @param {string} circleId - Circle ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>}
 */
export async function isMember(circleId, userId) {
  if (!circleId || !userId) return false;

  const members = await getMemberIds(circleId);
  return members.includes(userId);
}

/**
 * Get multiple Circles' members in a single batch query
 * @param {string[]} circleIds - Array of Circle IDs
 * @returns {Promise<Map<string, Array<{id: string, name?: string, icon?: string}>>>}
 */
export async function batchGetMembers(circleIds) {
  if (!circleIds || circleIds.length === 0) return new Map();

  const circles = await Circle.find({ id: { $in: circleIds } })
    .select("id members")
    .lean();

  const result = new Map();
  for (const circle of circles) {
    const members = (circle.members || []).filter(m => m?.id);
    result.set(circle.id, members);
  }

  return result;
}

/**
 * Extract domain from actor ID or URL
 * @param {string} actorId - Actor ID (e.g., "@user@domain.com" or "https://domain.com/users/user")
 * @returns {string|null}
 */
function extractDomain(actorId) {
  if (!actorId) return null;

  // Try URL parsing first
  try {
    const url = new URL(actorId);
    return url.hostname;
  } catch {
    // Fall back to @-based parsing
    const parts = actorId.split("@").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
  }
}

export default {
  getMembers,
  getMemberIds,
  getServerDomains,
  getMembersByDomain,
  partitionMembers,
  isMember,
  batchGetMembers,
};
