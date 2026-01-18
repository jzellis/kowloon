// /methods/containers/groups.js
// Clean utilities for Group operations

import { Group } from "#schema";

/**
 * Get all members of a Group
 * @param {string} groupId - Group ID
 * @returns {Promise<Array<{id: string, name?: string, icon?: string}>>}
 */
export async function getMembers(groupId) {
  if (!groupId) return [];

  const group = await Group.findOne({ id: groupId })
    .select("members")
    .lean();

  if (!group?.members) return [];

  return group.members.filter(m => m?.id);
}

/**
 * Get all member IDs from a Group (just the IDs, no metadata)
 * @param {string} groupId - Group ID
 * @returns {Promise<string[]>}
 */
export async function getMemberIds(groupId) {
  const members = await getMembers(groupId);
  return members.map(m => m.id);
}

/**
 * Get unique server domains from Group members
 * @param {string} groupId - Group ID
 * @returns {Promise<string[]>}
 */
export async function getServerDomains(groupId) {
  const members = await getMembers(groupId);
  const domains = new Set();

  for (const member of members) {
    const domain = extractDomain(member.id);
    if (domain) domains.add(domain);
  }

  return Array.from(domains);
}

/**
 * Group members by their server domain
 * @param {string} groupId - Group ID
 * @returns {Promise<Map<string, string[]>>}
 */
export async function getMembersByDomain(groupId) {
  const members = await getMembers(groupId);
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
 * Separate Group members into local vs remote
 * @param {string} groupId - Group ID
 * @param {string} localDomain - The local server domain
 * @returns {Promise<{local: string[], remote: string[]}>}
 */
export async function partitionMembers(groupId, localDomain) {
  const members = await getMemberIds(groupId);
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
 * Check if a user is a member of a Group
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>}
 */
export async function isMember(groupId, userId) {
  if (!groupId || !userId) return false;

  const members = await getMemberIds(groupId);
  return members.includes(userId);
}

/**
 * Get multiple Groups' members in a single batch query
 * @param {string[]} groupIds - Array of Group IDs
 * @returns {Promise<Map<string, Array<{id: string, name?: string, icon?: string}>>>}
 */
export async function batchGetMembers(groupIds) {
  if (!groupIds || groupIds.length === 0) return new Map();

  const groups = await Group.find({ id: { $in: groupIds } })
    .select("id members")
    .lean();

  const result = new Map();
  for (const group of groups) {
    const members = (group.members || []).filter(m => m?.id);
    result.set(group.id, members);
  }

  return result;
}

/**
 * Extract domain from actor ID or URL
 * @param {string} actorId - Actor ID
 * @returns {string|null}
 */
function extractDomain(actorId) {
  if (!actorId) return null;

  try {
    const url = new URL(actorId);
    return url.hostname;
  } catch {
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
