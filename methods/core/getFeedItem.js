// /methods/core/getFeedItem.js
// Get a FeedItem (rendered, sanitized version for end users)

import { FeedItems } from "#schema";

/**
 * Get a FeedItem by ID
 * FeedItems are the cached, rendered versions of posts with private info stripped
 * @param {string} id - FeedItem ID
 * @param {Object} opts - Options
 * @param {string} opts.viewerId - Viewing user ID (for ACL)
 * @returns {Promise<Object>} - feedItem(id, server, type, object, objectType, visibility, createdAt, updatedAt, url)
 */
export default async function getFeedItem(id, {
  viewerId = null,
} = {}) {
  if (!id) {
    throw new Error("getFeedItem requires id");
  }

  // TODO: Implement visibility check based on viewerId
  // For now, just fetch the item
  const item = await FeedItems.findOne({
    id,
    tombstoned: { $ne: true }
  }).lean();

  if (!item) {
    throw new Error(`FeedItem not found: ${id}`);
  }

  return item;
}
