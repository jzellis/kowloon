// /methods/feed/getTimeline.js
// Simplified timeline assembly using new federation architecture
//
// Key principles:
// - Circle ID is ALWAYS required (no default timeline)
// - Pulls from Circle members only (scoped by user's choice)
// - Also includes user's Groups/Events (regardless of Circle)
// - Uses pullFromRemote() for remote content
// - Queries FeedItems directly for public/server posts (no Feed LUT needed)

import { FeedItems, Feed, Circle, User } from "#schema";
import logger from "#methods/utils/logger.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import Kowloon from "#kowloon";

/**
 * Extract domain from actor ID or URL
 */
function extractDomain(str) {
  if (!str) return null;
  try {
    const url = new URL(str);
    return url.hostname;
  } catch {
    const parts = str.split("@").filter(Boolean);
    return parts[parts.length - 1];
  }
}

/**
 * Get user's block/mute list (users to exclude from timeline)
 */
async function getBlockedMutedUsers(viewerId) {
  const user = await User.findOne({ id: viewerId }).select("blocked muted").lean();
  if (!user) return [];

  const blockedMutedIds = new Set();

  // Get blocked Circle members
  if (user.blocked) {
    const blockedCircle = await Circle.findOne({ id: user.blocked }).select("members").lean();
    if (blockedCircle?.members) {
      blockedCircle.members.forEach((m) => blockedMutedIds.add(m.id));
    }
  }

  // Get muted Circle members
  if (user.muted) {
    const mutedCircle = await Circle.findOne({ id: user.muted }).select("members").lean();
    if (mutedCircle?.members) {
      mutedCircle.members.forEach((m) => blockedMutedIds.add(m.id));
    }
  }

  return Array.from(blockedMutedIds);
}

/**
 * Get user's group and event memberships
 */
async function getUserGroupsEvents(viewerId) {
  const user = await User.findOne({ id: viewerId }).select("groups events").lean();
  if (!user) return { groups: [], events: [] };

  const groups = [];
  const events = [];

  // Get groups from user's groups Circle
  if (user.groups) {
    const groupsCircle = await Circle.findOne({ id: user.groups }).select("members").lean();
    if (groupsCircle?.members) {
      groups.push(...groupsCircle.members.map((m) => m.id).filter((id) => id.startsWith("group:")));
    }
  }

  // Get events from user's events Circle
  if (user.events) {
    const eventsCircle = await Circle.findOne({ id: user.events }).select("members").lean();
    if (eventsCircle?.members) {
      events.push(...eventsCircle.members.map((m) => m.id).filter((id) => id.startsWith("event:")));
    }
  }

  return { groups, events };
}

/**
 * Assemble timeline for a user from a specific Circle
 *
 * @param {Object} options
 * @param {string} options.viewerId - Required: user requesting timeline
 * @param {string} options.circleId - Required: Circle to view timeline for
 * @param {string[]} [options.types=[]] - Filter by post types (Note, Article, etc.)
 * @param {string|Date} [options.since=null] - Pagination cursor
 * @param {number} [options.limit=50] - Max results
 *
 * @returns {Promise<{items: Array, nextCursor: string|null}>}
 */
export default async function getTimeline({
  viewerId,
  circleId,
  types = [],
  since = null,
  limit = 50,
} = {}) {
  if (!viewerId) {
    throw new Error("getTimeline requires viewerId");
  }

  if (!circleId) {
    throw new Error("getTimeline requires circleId");
  }

  const { domain: ourDomain } = getServerSettings();

  logger.info("getTimeline: Request", {
    viewerId,
    circleId,
    types: types.length,
    since,
    limit,
  });

  // 1. Get Circle members
  const circle = await Circle.findOne({ id: circleId }).select("members").lean();
  if (!circle || !circle.members || circle.members.length === 0) {
    logger.warn("getTimeline: Circle not found or empty", { circleId });
    return { items: [], nextCursor: null };
  }

  const allMembers = circle.members.map((m) => m.id).filter(Boolean);

  // 2. Separate local vs remote members
  const localMembers = [];
  const remoteMembersByDomain = new Map();

  for (const memberId of allMembers) {
    const memberDomain = extractDomain(memberId);
    if (memberDomain === ourDomain) {
      localMembers.push(memberId);
    } else {
      if (!remoteMembersByDomain.has(memberDomain)) {
        remoteMembersByDomain.set(memberDomain, []);
      }
      remoteMembersByDomain.get(memberDomain).push(memberId);
    }
  }

  // 3. Get viewer's groups/events (for additional content)
  const { groups, events } = await getUserGroupsEvents(viewerId);

  // Separate local vs remote groups/events
  const localGroups = groups.filter((g) => extractDomain(g) === ourDomain);
  const localEvents = events.filter((e) => extractDomain(e) === ourDomain);

  const remoteGroupsByDomain = new Map();
  const remoteEventsByDomain = new Map();

  groups.filter((g) => extractDomain(g) !== ourDomain).forEach((g) => {
    const domain = extractDomain(g);
    if (!remoteGroupsByDomain.has(domain)) {
      remoteGroupsByDomain.set(domain, []);
    }
    remoteGroupsByDomain.get(domain).push(g);
  });

  events.filter((e) => extractDomain(e) !== ourDomain).forEach((e) => {
    const domain = extractDomain(e);
    if (!remoteEventsByDomain.has(domain)) {
      remoteEventsByDomain.set(domain, []);
    }
    remoteEventsByDomain.get(domain).push(e);
  });

  // 4. Pull from remote servers
  for (const [remoteDomain, remoteAuthors] of remoteMembersByDomain.entries()) {
    const remoteGroups = remoteGroupsByDomain.get(remoteDomain) || [];
    const remoteEvents = remoteEventsByDomain.get(remoteDomain) || [];

    await Kowloon.federation.pullFromRemote({
      remoteDomain,
      authors: remoteAuthors, // People in this Circle
      members: [viewerId], // For Circle-addressed content
      groups: remoteGroups, // Groups viewer is in
      events: remoteEvents, // Events viewer attends
      types,
      since,
      limit,
      forUser: viewerId,
      createFeedLUT: true,
    });
  }

  // 5. Get Feed LUT item IDs for this viewer (Circle-addressed content)
  const feedLUT = await Feed.find({ actorId: viewerId }).select("objectId").lean();
  const feedItemIds = feedLUT.map((f) => f.objectId).filter(Boolean);

  // 6. Get blocked/muted users
  const blockedMutedUsers = await getBlockedMutedUsers(viewerId);

  // 7. Query local FeedItems
  const orConditions = [
    // Items in Feed LUT (Circle-addressed, groups, events)
    { id: { $in: feedItemIds } },
    // Public posts by Circle members
    {
      actorId: { $in: [...localMembers, ...allMembers] },
      to: "@public",
    },
    // Server posts (local members only)
    {
      actorId: { $in: localMembers },
      to: `@${ourDomain}`,
    },
  ];

  // Add local groups
  if (localGroups.length > 0) {
    orConditions.push({
      group: { $in: localGroups },
    });
  }

  // Add local events
  if (localEvents.length > 0) {
    orConditions.push({
      event: { $in: localEvents },
    });
  }

  const query = {
    $or: orConditions,
    // Exclude blocked/muted
    actorId: { $nin: blockedMutedUsers },
    // Exclude tombstoned
    tombstoned: { $ne: true },
  };

  // Add types filter
  if (types.length > 0) {
    query.type = { $in: types };
  }

  // Add since filter
  if (since) {
    const sinceDate = since instanceof Date ? since : new Date(since);
    query.publishedAt = { $gte: sinceDate };
  }

  const items = await FeedItems.find(query)
    .sort({ publishedAt: -1 })
    .limit(Number(limit))
    .lean();

  logger.info("getTimeline: Retrieved items", {
    viewerId,
    circleId,
    count: items.length,
  });

  return {
    items,
    nextCursor: items.length > 0 ? items[items.length - 1].publishedAt.toISOString() : null,
  };
}
