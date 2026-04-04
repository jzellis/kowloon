// /methods/feed/getTimeline.js
// Timeline assembly via FeedFanOut lookup table

import { FeedItems, FeedFanOut, Circle, User } from "#schema";
import logger from "#methods/utils/logger.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

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

async function getBlockedMutedUsers(viewerId) {
  const user = await User.findOne({ id: viewerId }).select("circles").lean();
  if (!user) return [];

  const blockedMutedIds = new Set();

  if (user.circles?.blocked) {
    const blockedCircle = await Circle.findOne({ id: user.circles.blocked }).select("members").lean();
    if (blockedCircle?.members) {
      blockedCircle.members.forEach((m) => blockedMutedIds.add(m.id));
    }
  }

  if (user.circles?.muted) {
    const mutedCircle = await Circle.findOne({ id: user.circles.muted }).select("members").lean();
    if (mutedCircle?.members) {
      mutedCircle.members.forEach((m) => blockedMutedIds.add(m.id));
    }
  }

  return Array.from(blockedMutedIds);
}

async function getUserGroups(viewerId) {
  const user = await User.findOne({ id: viewerId }).select("circles").lean();
  if (!user) return [];

  const groups = [];

  if (user.circles?.groups) {
    const groupsCircle = await Circle.findOne({ id: user.circles.groups }).select("members").lean();
    if (groupsCircle?.members) {
      groups.push(...groupsCircle.members.map((m) => m.id).filter((id) => id?.startsWith("group:")));
    }
  }

  return groups;
}

/**
 * Compute the oldest lastFetchedAt across a set of member IDs within a circle.
 * Returns null if any member has never been fetched (forces full fetch).
 */
function oldestFetchedAt(circle, memberIds) {
  let oldest = new Date(); // start with now
  for (const memberId of memberIds) {
    const member = circle.members.find((m) => m.id === memberId);
    if (!member?.lastFetchedAt) return null; // never fetched — pull everything
    const t = new Date(member.lastFetchedAt);
    if (t < oldest) oldest = t;
  }
  return oldest;
}

/**
 * Update lastFetchedAt for a set of remote members in a circle.
 */
async function updateMemberFetchedAt(circleId, circle, memberIds) {
  const now = new Date();
  const setFields = {};
  for (const memberId of memberIds) {
    const idx = circle.members.findIndex((m) => m.id === memberId);
    if (idx !== -1) {
      setFields[`members.${idx}.lastFetchedAt`] = now;
    }
  }
  if (Object.keys(setFields).length > 0) {
    await Circle.updateOne({ id: circleId }, { $set: setFields });
  }
}

/**
 * Assemble timeline for a user from a specific Circle
 *
 * @param {Object} options
 * @param {string} options.viewerId - Required: user requesting timeline
 * @param {string} options.circleId - Required: Circle to view timeline for
 * @param {string[]} [options.types=[]] - Filter by post types (Note, Article, etc.)
 * @param {string|Date} [options.since=null] - Pagination cursor (ISO string or Date)
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
  if (!viewerId) throw new Error("getTimeline requires viewerId");
  if (!circleId) throw new Error("getTimeline requires circleId");

  const { domain: ourDomain } = getServerSettings();

  logger.info("getTimeline: Request", { viewerId, circleId, types: types.length, since, limit });

  // 1. Get circle (with members including lastFetchedAt)
  const circle = await Circle.findOne({ id: circleId }).lean();
  if (!circle) {
    logger.warn("getTimeline: Circle not found", { circleId });
    return { items: [], nextCursor: null };
  }

  // Always include the viewer so their own posts appear even when the circle is empty
  const memberSet = new Set(circle.members?.map((m) => m.id).filter(Boolean) ?? []);
  memberSet.add(viewerId);
  const allMembers = Array.from(memberSet);

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

  // 3. Get viewer's groups
  const groups = await getUserGroups(viewerId);
  const localGroups = groups.filter((g) => extractDomain(g) === ourDomain);
  const remoteGroupsByDomain = new Map();

  groups.filter((g) => extractDomain(g) !== ourDomain).forEach((g) => {
    const domain = extractDomain(g);
    if (!remoteGroupsByDomain.has(domain)) remoteGroupsByDomain.set(domain, []);
    remoteGroupsByDomain.get(domain).push(g);
  });

  // 4. Pull from remote servers (on-demand, cursor-based)
  const Kowloon = (await import("#kowloon")).default;

  for (const [remoteDomain, remoteAuthors] of remoteMembersByDomain.entries()) {
    const remoteGroups = remoteGroupsByDomain.get(remoteDomain) || [];

    // Use oldest lastFetchedAt across these members as the since cursor
    // (null = at least one member never fetched — pull everything)
    const pullSince = since ?? oldestFetchedAt(circle, remoteAuthors);

    const result = await Kowloon.federation.pullFromRemote({
      remoteDomain,
      from: remoteAuthors,
      to: [viewerId],
      since: pullSince,
      limit,
    });

    // Update lastFetchedAt for each member on success
    if (!result.error) {
      await updateMemberFetchedAt(circleId, circle, remoteAuthors);
    }
  }

  // 5. Get blocked/muted users
  const blockedMutedUsers = await getBlockedMutedUsers(viewerId);

  // 6. Query FeedFanOut for feed item IDs
  const fanOutActorFilter = blockedMutedUsers.length > 0
    ? { $in: allMembers, $nin: blockedMutedUsers }
    : { $in: allMembers };

  const fanOutOrConditions = [
    {
      actorId: fanOutActorFilter,
      to: { $in: ["@public", "@server", viewerId] },
    },
    // Items delivered directly to this viewer by pullFromRemote (e.g. via a
    // server-level follow where actorId may not be in the circle member list)
    { to: viewerId },
  ];

  if (localGroups.length > 0) {
    fanOutOrConditions.push({
      groupId: { $in: localGroups },
      to: { $in: ["@public", "@server", viewerId] },
    });
  }

  const fanOutDocs = await FeedFanOut.find({ $or: fanOutOrConditions })
    .select("feedItemId")
    .lean();

  const feedItemIds = [...new Set(fanOutDocs.map((f) => f.feedItemId).filter(Boolean))];

  if (feedItemIds.length === 0) {
    logger.info("getTimeline: No FeedFanOut records found", { viewerId, circleId });
    return { items: [], nextCursor: null };
  }

  // 7. Query FeedItems by IDs with optional filters
  const itemsQuery = {
    id: { $in: feedItemIds },
    tombstoned: { $ne: true },
    objectType: { $nin: ["Group", "Circle"] },
  };

  if (types.length > 0) {
    itemsQuery.type = { $in: types };
  }

  if (since) {
    const sinceDate = since instanceof Date ? since : new Date(since);
    itemsQuery.publishedAt = { $gte: sinceDate };
  }

  const items = await FeedItems.find(itemsQuery)
    .sort({ publishedAt: -1 })
    .limit(Number(limit))
    .lean();

  logger.info("getTimeline: Retrieved items", { viewerId, circleId, count: items.length });

  return {
    items,
    nextCursor: items.length > 0 ? new Date(items[items.length - 1].publishedAt).toISOString() : null,
  };
}
