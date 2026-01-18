// /methods/containers/events.js
// Clean utilities for Event operations

import { Event } from "#schema";

/**
 * Get all members (attendees) of an Event
 * @param {string} eventId - Event ID
 * @returns {Promise<Array<{id: string, name?: string, icon?: string}>>}
 */
export async function getMembers(eventId) {
  if (!eventId) return [];

  const event = await Event.findOne({ id: eventId })
    .select("members")
    .lean();

  if (!event?.members) return [];

  return event.members.filter(m => m?.id);
}

/**
 * Get all member IDs from an Event (just the IDs, no metadata)
 * @param {string} eventId - Event ID
 * @returns {Promise<string[]>}
 */
export async function getMemberIds(eventId) {
  const members = await getMembers(eventId);
  return members.map(m => m.id);
}

/**
 * Get unique server domains from Event attendees
 * @param {string} eventId - Event ID
 * @returns {Promise<string[]>}
 */
export async function getServerDomains(eventId) {
  const members = await getMembers(eventId);
  const domains = new Set();

  for (const member of members) {
    const domain = extractDomain(member.id);
    if (domain) domains.add(domain);
  }

  return Array.from(domains);
}

/**
 * Group Event attendees by their server domain
 * @param {string} eventId - Event ID
 * @returns {Promise<Map<string, string[]>>}
 */
export async function getMembersByDomain(eventId) {
  const members = await getMembers(eventId);
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
 * Separate Event attendees into local vs remote
 * @param {string} eventId - Event ID
 * @param {string} localDomain - The local server domain
 * @returns {Promise<{local: string[], remote: string[]}>}
 */
export async function partitionMembers(eventId, localDomain) {
  const members = await getMemberIds(eventId);
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
 * Check if a user is attending an Event
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>}
 */
export async function isMember(eventId, userId) {
  if (!eventId || !userId) return false;

  const members = await getMemberIds(eventId);
  return members.includes(userId);
}

/**
 * Get multiple Events' members in a single batch query
 * @param {string[]} eventIds - Array of Event IDs
 * @returns {Promise<Map<string, Array<{id: string, name?: string, icon?: string}>>>}
 */
export async function batchGetMembers(eventIds) {
  if (!eventIds || eventIds.length === 0) return new Map();

  const events = await Event.find({ id: { $in: eventIds } })
    .select("id members")
    .lean();

  const result = new Map();
  for (const event of events) {
    const members = (event.members || []).filter(m => m?.id);
    result.set(event.id, members);
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
