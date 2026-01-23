// /methods/core/getCollection.js
// Universal function for retrieving collections of objects of any type

import { Activity, Circle, Group, Post, User } from "#schema";

const PAGE_SIZE = 20;

/**
 * Retrieve a collection of objects of a specified type
 *
 * @param {string} type - Object type: "Activity", "Post", "Circle", "Group", "User", etc.
 * @param {Object} options - Query options
 * @param {string} options.viewerId - ID of viewing user (for ACL filtering)
 * @param {Object} options.query - MongoDB query object
 * @param {number} options.limit - Number of items to return (optional if page is provided)
 * @param {number} options.offset - Number of items to skip (default: 0)
 * @param {number} options.page - Page number (auto-calculates limit=20, offset)
 * @param {Object} options.sort - MongoDB sort object (default: { createdAt: -1 })
 * @param {boolean} options.localOnly - Exclude remote cached items (default: false)
 * @returns {Promise<{items: Array, total: number, hasMore: boolean}>}
 */
export default async function getCollection(type, {
  viewerId = null,
  query = {},
  limit,
  offset = 0,
  page,
  sort = { createdAt: -1 },
  localOnly = false,
} = {}) {

  // Handle pagination: page parameter takes precedence
  let finalLimit = limit;
  let finalOffset = offset;

  if (page !== undefined) {
    finalLimit = PAGE_SIZE;
    finalOffset = (page - 1) * PAGE_SIZE;
  }

  // If no limit specified and no page specified, default to PAGE_SIZE
  if (finalLimit === undefined) {
    finalLimit = PAGE_SIZE;
  }

  // Get the appropriate model
  const modelMap = {
    Activity,
    Circle,
    Group,
    Post,
    User,
  };

  const Model = modelMap[type];
  if (!Model) {
    throw new Error(`Unknown type: ${type}`);
  }

  // Build final query
  const finalQuery = { ...query };

  // Filter out remote cached items if localOnly
  if (localOnly) {
    finalQuery.cached = { $ne: true };
  }

  // Apply ACL filters based on type and viewerId
  if (viewerId) {
    // For Posts: filter out blocked/muted users' content
    if (type === "Post") {
      const viewer = await User.findOne({ id: viewerId })
        .select("circles")
        .lean();

      if (viewer?.circles?.blocked || viewer?.circles?.muted) {
        const blockedUsers = [];
        const mutedUsers = [];

        if (viewer.circles.blocked) {
          const blockedCircle = await Circle.findOne({ id: viewer.circles.blocked })
            .select("members")
            .lean();
          if (blockedCircle?.members) {
            blockedUsers.push(...blockedCircle.members.map(m => m.id));
          }
        }

        if (viewer.circles.muted) {
          const mutedCircle = await Circle.findOne({ id: viewer.circles.muted })
            .select("members")
            .lean();
          if (mutedCircle?.members) {
            mutedUsers.push(...mutedCircle.members.map(m => m.id));
          }
        }

        const excludedUsers = [...new Set([...blockedUsers, ...mutedUsers])];
        if (excludedUsers.length > 0) {
          finalQuery.attributedTo = { $nin: excludedUsers };
        }
      }
    }

    // For Circles/Groups: filter based on visibility and membership
    if (type === "Circle" || type === "Group") {
      finalQuery.$or = [
        { visibility: "public" },
        { "members.id": viewerId },
      ];
    }
  } else {
    // No viewer: only show public items
    if (type === "Circle" || type === "Group") {
      finalQuery.visibility = "public";
    }
    if (type === "Post") {
      finalQuery.visibility = "public";
    }
  }

  // Execute query
  const [items, total] = await Promise.all([
    Model.find(finalQuery)
      .sort(sort)
      .skip(finalOffset)
      .limit(finalLimit)
      .lean(),
    Model.countDocuments(finalQuery),
  ]);

  return {
    items,
    total,
    hasMore: finalOffset + items.length < total,
  };
}
