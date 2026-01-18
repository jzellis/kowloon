// /methods/federation/pullFromRemote.js
// Universal function for retrieving content from remote servers
// Used by both on-demand timeline requests and background polling worker

import fetch from "node-fetch";
import https from "https";
import { FeedItems, Feed } from "#schema";
import logger from "#methods/utils/logger.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

/**
 * Pull content from a remote server
 *
 * @param {Object} options
 * @param {string} options.remoteDomain - Required: which server to pull from
 * @param {string[]} [options.authors=[]] - Authors to get posts from (usually Circle members)
 * @param {string[]} [options.members=[]] - Local users who should see Circle-addressed content
 * @param {string[]} [options.groups=[]] - Group IDs to get posts from
 * @param {string[]} [options.events=[]] - Event IDs to get posts from
 * @param {string|Date} [options.since] - Only items after this timestamp
 * @param {string[]} [options.types=[]] - Filter by post types (Note, Article, etc.)
 * @param {number} [options.limit=100] - Max items to retrieve
 * @param {string} [options.forUser=null] - Specific local user (creates Feed LUT for them only)
 * @param {boolean} [options.createFeedLUT=true] - Whether to create Feed entries
 *
 * @returns {Promise<{items: Array, nextCursor: string|null, error: string|null}>}
 */
export default async function pullFromRemote({
  remoteDomain,
  authors = [],
  members = [],
  groups = [],
  events = [],
  since = null,
  types = [],
  limit = 100,
  forUser = null,
  createFeedLUT = true,
} = {}) {
  if (!remoteDomain) {
    return { items: [], nextCursor: null, error: "remoteDomain is required" };
  }

  const { domain: ourDomain } = getServerSettings();

  try {
    // Build query string
    const params = new URLSearchParams();

    if (authors.length > 0) {
      authors.forEach((a) => params.append("authors", a));
    }
    if (members.length > 0) {
      members.forEach((m) => params.append("members", m));
    }
    if (groups.length > 0) {
      groups.forEach((g) => params.append("groups", g));
    }
    if (events.length > 0) {
      events.forEach((e) => params.append("events", e));
    }
    if (types.length > 0) {
      types.forEach((t) => params.append("types", t));
    }
    if (since) {
      const sinceDate = since instanceof Date ? since : new Date(since);
      params.append("since", sinceDate.toISOString());
    }
    params.append("limit", String(limit));

    const url = `https://${remoteDomain}/.well-known/kowloon/pull?${params}`;

    logger.info("pullFromRemote: Fetching", {
      remoteDomain,
      authors: authors.length,
      members: members.length,
      groups: groups.length,
      events: events.length,
      types: types.length,
      since,
      limit,
    });

    // TODO: Sign request with HTTP Signature
    // For now, using unsigned requests (will fail on production servers)

    // Allow self-signed certs for local development
    const agent = new https.Agent({
      rejectUnauthorized: process.env.NODE_ENV === "production",
    });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/activity+json",
        "User-Agent": `Kowloon/${ourDomain}`,
      },
      agent,
      timeout: 30000, // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      logger.error("pullFromRemote: HTTP error", {
        remoteDomain,
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return {
        items: [],
        nextCursor: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const items = data.orderedItems || data.items || [];
    const nextCursor = data.next || null;

    logger.info("pullFromRemote: Retrieved items", {
      remoteDomain,
      count: items.length,
      nextCursor,
    });

    // Upsert items into FeedItems collection
    let upserted = 0;
    const itemIds = [];

    for (const item of items) {
      if (!item.id) {
        logger.warn("pullFromRemote: Item missing ID, skipping", { item });
        continue;
      }

      try {
        await FeedItems.findOneAndUpdate(
          { id: item.id },
          { $set: item },
          { upsert: true, new: true }
        );
        upserted++;
        itemIds.push(item.id);
      } catch (err) {
        logger.error("pullFromRemote: Upsert failed", {
          remoteDomain,
          itemId: item.id,
          error: err.message,
        });
      }
    }

    logger.info("pullFromRemote: Upserted items", {
      remoteDomain,
      total: items.length,
      upserted,
    });

    // Create Feed LUT entries if requested
    if (createFeedLUT && itemIds.length > 0) {
      const targetUsers = forUser ? [forUser] : members;

      if (targetUsers.length > 0) {
        await createFeedEntries(itemIds, targetUsers, remoteDomain);
      }
    }

    return {
      items,
      nextCursor,
      error: null,
    };
  } catch (error) {
    logger.error("pullFromRemote: Error", {
      remoteDomain,
      error: error.message,
      stack: error.stack,
    });
    return {
      items: [],
      nextCursor: null,
      error: error.message,
    };
  }
}

/**
 * Create Feed LUT entries for pulled items
 *
 * @param {string[]} itemIds - FeedItems IDs
 * @param {string[]} userIds - Local user IDs to create entries for
 * @param {string} remoteDomain - Remote domain (for logging)
 */
async function createFeedEntries(itemIds, userIds, remoteDomain) {
  try {
    // Fetch the FeedItems to get metadata
    const feedItems = await FeedItems.find({ id: { $in: itemIds } }).lean();

    const bulkOps = [];

    for (const item of feedItems) {
      for (const userId of userIds) {
        bulkOps.push({
          updateOne: {
            filter: {
              actorId: userId, // The local viewer
              objectId: item.id, // The FeedItems ID
            },
            update: {
              $set: {
                actorId: userId,
                objectId: item.id,
                activityActorId: item.actorId, // Original author
                type: item.objectType, // Main type (Post, Bookmark, etc.)
                objectType: item.type, // Subtype (Note, Article, etc.)
                reason: "remote", // Mark as remotely pulled
                createdAt: item.publishedAt || item.createdAt || new Date(),
                fetchedAt: new Date(),
                // Capabilities will be computed later during timeline assembly
                canReply: false, // Default conservative
                canReact: false, // Default conservative
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await Feed.bulkWrite(bulkOps);
      logger.info("pullFromRemote: Created Feed LUT entries", {
        remoteDomain,
        items: feedItems.length,
        users: userIds.length,
        total: bulkOps.length,
      });
    }
  } catch (err) {
    logger.error("pullFromRemote: Feed LUT creation failed", {
      remoteDomain,
      error: err.message,
    });
  }
}
