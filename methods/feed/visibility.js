// /methods/feed/visibility.js
// Visibility and capability evaluators for FeedItems items
// Used by all GET endpoints to determine what viewers can see and do

import { Circle, Group, Event } from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

/**
 * Check if viewer can see a FeedItems item
 * @param {Object} feedCacheItem - FeedItems document
 * @param {string|null} viewerId - Viewer's ID (null = anonymous)
 * @param {Object} context - Pre-loaded context { followerMap, membershipMap, grants }
 * @returns {Promise<boolean>}
 */
export async function canView(feedCacheItem, viewerId, context = {}) {
  const { to, origin } = feedCacheItem;
  const {
    followerMap = new Map(),
    membershipMap = new Map(),
    grants = {},
  } = context;

  // "public" → everyone can see
  if (to === "public" || to === "@public") {
    return true;
  }

  // "server" → local users only (or expose to all if you want)
  if (to === "server") {
    if (!viewerId) return false; // Anonymous can't see server-only
    const { domain } = getServerSettings();
    const isLocalViewer = viewerId
      ?.toLowerCase()
      .endsWith(`@${domain?.toLowerCase()}`);
    return isLocalViewer;
  }

  // "audience" → depends on origin
  if (to === "audience") {
    if (!viewerId) return false; // Anonymous can't see audience-only

    if (origin === "local") {
      // Local: check if viewer is in addressed circles/groups/events
      // This requires addressedIds which aren't stored in FeedItems
      // We need to parse from the original audience field or use Feed fan-out
      // For now, fall back to checking membership
      // TODO: Consider storing addressedIds in FeedItems for reads
      return false; // Conservative: deny unless we can verify
    } else {
      // Remote: check if viewer has a grant
      return Boolean(grants[viewerId]);
    }
  }

  return false;
}

/**
 * Build follower map: actorId -> Set of follower IDs
 * @param {string[]} actorIds - Actor IDs to check
 * @returns {Promise<Map<string, Set<string>>>}
 */
export async function buildFollowerMap(actorIds = []) {
  if (actorIds.length === 0) return new Map();

  const { User } = await import("#schema");

  const users = await User.find({ deletedAt: null, active: { $ne: false } })
    .select("id following")
    .lean();

  if (users.length === 0) return new Map();

  // Get all unique following circle IDs
  const followingCircleIds = users.map((u) => u.following).filter(Boolean);
  if (followingCircleIds.length === 0) return new Map();

  // Batch fetch all following circles
  const followingCircles = await Circle.find({
    id: { $in: followingCircleIds },
  }).lean();

  // Build map: circleId -> member IDs
  const circleMembers = new Map();
  for (const circle of followingCircles) {
    const memberIds = (circle.members || []).map((m) => m.id).filter(Boolean);
    circleMembers.set(circle.id, memberIds);
  }

  // Build reverse map: actorId -> Set of followers
  const followerMap = new Map();
  for (const user of users) {
    if (!user.following) continue;
    const following = circleMembers.get(user.following) || [];
    for (const followedId of following) {
      if (!followerMap.has(followedId)) {
        followerMap.set(followedId, new Set());
      }
      followerMap.get(followedId).add(user.id);
    }
  }

  return followerMap;
}

/**
 * Check if viewer follows author
 * @param {string} viewerId - The viewer
 * @param {string} authorId - The author
 * @param {Map<string, Set<string>>} followerMap - Pre-built follower map
 * @returns {boolean}
 */
export function follows(viewerId, authorId, followerMap) {
  const followers = followerMap.get(authorId);
  return followers ? followers.has(viewerId) : false;
}

/**
 * Build membership map for circles/groups/events
 * @param {string[]} objectIds - Circle/Group/Event IDs
 * @returns {Promise<Map<string, Set<string>>>}
 */
export async function buildMembershipMap(objectIds) {
  if (!objectIds || objectIds.length === 0) return new Map();

  const membershipMap = new Map();

  // Group by type
  const circleIds = objectIds.filter((id) => id.startsWith("circle:"));
  const groupIds = objectIds.filter((id) => id.startsWith("group:"));
  const eventIds = objectIds.filter((id) => id.startsWith("event:"));

  // Batch fetch
  const [circles, groups, events] = await Promise.all([
    circleIds.length > 0 ? Circle.find({ id: { $in: circleIds } }).lean() : [],
    groupIds.length > 0 ? Group.find({ id: { $in: groupIds } }).lean() : [],
    eventIds.length > 0 ? Event.find({ id: { $in: eventIds } }).lean() : [],
  ]);

  // Build map
  for (const obj of [...circles, ...groups, ...events]) {
    const memberIds = (obj.members || []).map((m) => m.id).filter(Boolean);
    membershipMap.set(obj.id, new Set(memberIds));
  }

  return membershipMap;
}

/**
 * Check if viewer is in local audience
 * @param {string} viewerId - The viewer
 * @param {string[]} addressedIds - LOCAL circle/group/event IDs
 * @param {Map<string, Set<string>>} membershipMap - Pre-built membership map
 * @returns {boolean}
 */
export function inLocalAudience(viewerId, addressedIds, membershipMap) {
  if (!addressedIds || addressedIds.length === 0) return false;

  for (const id of addressedIds) {
    const members = membershipMap.get(id);
    if (members?.has(viewerId)) return true;
  }

  return false;
}

/**
 * Evaluate per-viewer capability (canReply/canReact)
 * @param {Object} opts
 * @param {string} opts.viewerId - The viewer
 * @param {string} opts.authorId - The author
 * @param {string} opts.capability - Capability value ("public"|"followers"|"audience"|"none")
 * @param {string} opts.origin - Origin ("local"|"remote")
 * @param {string[]} opts.addressedIds - LOCAL addressed IDs (for local content)
 * @param {Object} opts.grants - Remote grants object (for remote content)
 * @param {Map} opts.followerMap - Pre-built follower map
 * @param {Map} opts.membershipMap - Pre-built membership map
 * @returns {boolean}
 */
export function evaluateCapability({
  viewerId,
  authorId,
  capability,
  origin,
  addressedIds = [],
  grants = {},
  followerMap,
  membershipMap,
}) {
  if (!capability || typeof capability !== "string") return false;

  const cap = capability.toLowerCase().trim();

  // "none" → always false
  if (cap === "none") return false;

  // Not logged in → false (even for "public" - must be authenticated to reply/react)
  if (!viewerId) return false;

  // "public" → true for any authenticated user
  if (cap === "public" || cap === "@public") return true;

  // "followers" → check if viewer follows author
  if (cap === "followers") {
    return follows(viewerId, authorId, followerMap);
  }

  // "audience" → depends on origin
  if (cap === "audience") {
    if (origin === "remote") {
      // Remote: use grants/token only (never resolve circles)
      return Boolean(grants[viewerId]);
    } else {
      // Local: check if viewer is in addressed circles/groups/events
      return inLocalAudience(viewerId, addressedIds, membershipMap);
    }
  }

  return false;
}

/**
 * Enrich FeedItems item with per-viewer capabilities
 * @param {Object} feedCacheItem - FeedItems document
 * @param {string|null} viewerId - Viewer's ID (null = anonymous)
 * @param {Object} context - Pre-loaded context { followerMap, membershipMap, grants, addressedIds }
 * @returns {Object} - Item with canReply/canReact booleans
 */
export function enrichWithCapabilities(feedCacheItem, viewerId, context = {}) {
  const {
    followerMap = new Map(),
    membershipMap = new Map(),
    grants = {},
    addressedIds = [],
  } = context;

  const { actorId, origin, canReply, canReact } = feedCacheItem;

  const canReplyBool = evaluateCapability({
    viewerId,
    authorId: actorId,
    capability: canReply,
    origin,
    addressedIds,
    grants,
    followerMap,
    membershipMap,
  });

  const canReactBool = evaluateCapability({
    viewerId,
    authorId: actorId,
    capability: canReact,
    origin,
    addressedIds,
    grants,
    followerMap,
    membershipMap,
  });

  return {
    ...feedCacheItem,
    canReply: canReplyBool,
    canReact: canReactBool,
  };
}

/**
 * Build visibility filter for FeedItems queries
 * @param {string|null} viewerId - Viewer's ID (null = anonymous)
 * @returns {Object} - MongoDB filter
 */
export function buildVisibilityFilter(viewerId) {
  if (!viewerId) {
    // Anonymous: only public items
    return {
      to: { $in: ["public", "@public"] },
      deletedAt: null,
      tombstoned: { $ne: true },
    };
  }

  // Authenticated: public + server (if local) + audience (TODO)
  const { domain } = getServerSettings();
  const isLocalViewer = viewerId
    ?.toLowerCase()
    .endsWith(`@${domain?.toLowerCase()}`);

  const toFilter = isLocalViewer
    ? { $in: ["public", "@public", "server"] }
    : { $in: ["public", "@public"] };

  return {
    to: toFilter,
    deletedAt: null,
    tombstoned: { $ne: true },
  };
}

export default {
  canView,
  buildFollowerMap,
  buildMembershipMap,
  follows,
  inLocalAudience,
  evaluateCapability,
  enrichWithCapabilities,
  buildVisibilityFilter,
};
