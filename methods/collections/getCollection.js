// /methods/collections/getCollection.js
// Universal collection query function that pulls from Feed (for auth users) or FeedCache (for public)

import { FeedCache, Feed } from "#schema";
import kowloonId from "#methods/parse/kowloonId.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import { getDomain } from "#methods/settings/schemaHelpers.js";
import computeVisibilityFlags from "./computeVisibilityFlags.js";

/**
 * Normalize filter values: convert arrays to $in queries
 * @param {Object} filters - Raw filter object
 * @returns {Object} Normalized filter object
 */
function normalizeFilters(filters) {
  const normalized = {};
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      normalized[key] = { $in: value };
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Get collection items with proper visibility filtering
 *
 * @param {Object} options - Query options
 * @param {string} options.type - Required: "Post", "Bookmark", "Page", "Activity", etc.
 * @param {string} [options.objectType] - Optional: filter by subtype (e.g., "Note", "Article", "Folder")
 * @param {string} [options.actorId] - Optional: viewer's actorId for visibility filtering
 * @param {number} [options.limit=50] - Max items to return
 * @param {number} [options.offset=0] - Skip this many items
 * @param {string} [options.sortBy="createdAt"] - Field to sort by
 * @param {number} [options.sortOrder=-1] - Sort order: -1 for desc, 1 for asc
 * @param {Object} [options.filters] - Additional filters to apply to query
 *   Supports arrays for any field, which will be converted to $in queries
 *   Examples:
 *     { actorId: "user:123" } → filter by single actor
 *     { actorId: ["user:123", "user:456"] } → filter by multiple actors
 *     { to: "group:xyz" } → filter by single target
 *     { to: ["group:xyz", "circle:abc"] } → filter by multiple targets
 *
 * @returns {Promise<Object>} { items: Array, total: number, hasMore: boolean }
 */
export default async function getCollection({
  type,
  objectType = undefined,
  actorId = undefined,
  limit = 50,
  offset = 0,
  sortBy = "createdAt",
  sortOrder = -1,
  filters = {},
} = {}) {
  if (!type) {
    throw new Error("type is required");
  }

  const domain = getDomain();

  // Determine if viewer is a local authenticated user
  let isLocalUser = false;
  if (actorId) {
    const parsed = kowloonId(actorId);
    isLocalUser = parsed.domain && isLocalDomain(parsed.domain);
  }

  // Normalize filters to handle arrays
  const normalizedFilters = normalizeFilters(filters);

  // Build query and execute based on authentication
  const sort = { [sortBy]: sortOrder, _id: sortOrder };

  if (!actorId || !isLocalUser) {
    // Unauthenticated or remote user: query FeedCache for public items only
    const query = {
      objectType: type, // FeedCache uses "objectType" for main type
      to: "public",
      tombstoned: { $ne: true },
      ...normalizedFilters,
    };

    // Filter by subtype if provided
    if (objectType) {
      query.type = objectType; // FeedCache uses "type" for subtype
    }

    const [rawItems, total] = await Promise.all([
      FeedCache.find(query)
        .sort({ publishedAt: sortOrder, _id: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean(),
      FeedCache.countDocuments(query),
    ]);

    // Add visibility flags to each item
    const items = await Promise.all(
      rawItems.map(async (item) => {
        const flags = await computeVisibilityFlags(item, actorId, isLocalUser);
        return {
          ...item,
          _visibility: flags,
        };
      })
    );

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      limit,
      offset,
    };
  }

  // Local authenticated user: query Feed for personalized view
  // This includes:
  // - Items in their personal feed
  // - Public items (via Feed entries)
  // - Server-wide items (via Feed entries)
  const feedQuery = {
    actorId,
    type, // Feed uses "type" for main type
    hidden: { $ne: true },
    ...filters,
  };

  // Filter by subtype if provided
  if (objectType) {
    feedQuery.objectType = objectType; // Feed uses "objectType" for subtype
  }

  // Query Feed for Feed entries (which already represent visibility)
  const [feedEntries, feedTotal] = await Promise.all([
    Feed.find(feedQuery).sort(sort).skip(offset).limit(limit).lean(),
    Feed.countDocuments(feedQuery),
  ]);

  // Hydrate with full FeedCache objects
  const objectIds = feedEntries.map((entry) => entry.objectId);
  const cacheItems = await FeedCache.find({
    id: { $in: objectIds },
    tombstoned: { $ne: true },
  }).lean();

  // Create a map for quick lookup
  const cacheMap = new Map(cacheItems.map((item) => [item.id, item]));

  // Merge Feed metadata with FeedCache objects, preserving Feed order
  const rawItems = feedEntries
    .map((entry) => {
      const cached = cacheMap.get(entry.objectId);
      if (!cached) return null;

      return {
        ...cached,
        _feedMeta: {
          reason: entry.reason,
          seenAt: entry.seenAt,
          canReply: entry.canReply,
          canReact: entry.canReact,
          pinned: entry.pinned,
          rank: entry.rank,
        },
      };
    })
    .filter(Boolean);

  // Add visibility flags to each item
  const items = await Promise.all(
    rawItems.map(async (item) => {
      const flags = await computeVisibilityFlags(item, actorId, isLocalUser);
      return {
        ...item,
        _visibility: flags,
      };
    })
  );

  return {
    items,
    total: feedTotal,
    hasMore: offset + items.length < feedTotal,
    limit,
    offset,
  };
}
