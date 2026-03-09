// /methods/federation/pullFromRemote.js
// Pull content from a remote server using the batch-pull protocol.
//
// Sends GET /outbox?from=...&to=...&since=... to the remote server.
// Remote server returns:
//   { items: [...FeedItems], recipients: [{ itemId, to: [...localUserIds] }] }
//
// Upserts all items into local FeedItems, then enqueues per-user FeedFanOut
// records based on the recipients map returned by the remote server.

import crypto from "crypto";
import fetch from "node-fetch";
import https from "https";
import { FeedItems, FeedFanOut } from "#schema";
import logger from "#methods/utils/logger.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

function dedupeHash(feedItemId, to) {
  return crypto.createHash("sha256").update(`${feedItemId}:${to}`).digest("hex");
}

/**
 * Pull content from a remote server on behalf of local users.
 *
 * @param {Object} options
 * @param {string}   options.remoteDomain  - Required: remote server to pull from
 * @param {string[]} options.from          - Remote users/servers to pull from
 *                                           (user: "@alice@kwln2.local", server: "@kwln2.local")
 * @param {string[]} options.to            - Local user IDs pulling on behalf of
 * @param {string|Date} [options.since]    - Only items after this timestamp
 * @param {number}   [options.limit=100]   - Max items to retrieve
 *
 * @returns {Promise<{ items: Array, nextCursor: string|null, error: string|null }>}
 */
export default async function pullFromRemote({
  remoteDomain,
  from = [],
  to = [],
  since = null,
  limit = 100,
} = {}) {
  if (!remoteDomain) {
    return { items: [], nextCursor: null, error: "remoteDomain is required" };
  }
  if (from.length === 0) {
    return { items: [], nextCursor: null, error: "from is required" };
  }
  if (to.length === 0) {
    return { items: [], nextCursor: null, error: "to is required" };
  }

  const { domain: ourDomain } = getServerSettings();

  try {
    const params = new URLSearchParams();
    from.forEach((f) => params.append("from", f));
    to.forEach((t) => params.append("to", t));
    if (since) {
      const sinceDate = since instanceof Date ? since : new Date(since);
      params.append("since", sinceDate.toISOString());
    }
    params.append("limit", String(limit));

    const url = `https://${remoteDomain}/outbox?${params}`;

    logger.info("pullFromRemote: Fetching", {
      remoteDomain,
      from: from.length,
      to: to.length,
      since,
      limit,
    });

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
      timeout: 30000,
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
    const items = data.items || data.orderedItems || [];
    const recipients = data.recipients || []; // [{ itemId, to: [userId, ...] }]
    const nextCursor = data.next || null;

    logger.info("pullFromRemote: Retrieved", {
      remoteDomain,
      items: items.length,
      recipientEntries: recipients.length,
    });

    // Upsert all items into local FeedItems
    const upsertedIds = new Set();
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
        upsertedIds.add(item.id);
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
      upserted: upsertedIds.size,
    });

    // Build itemId → FeedItem map for fan-out metadata
    const feedItemMap = new Map();
    if (recipients.length > 0 && upsertedIds.size > 0) {
      const feedItems = await FeedItems.find({
        id: { $in: [...upsertedIds] },
      }).lean();
      for (const fi of feedItems) feedItemMap.set(fi.id, fi);
    }

    // Create per-user FeedFanOut records directly from the recipients map.
    // We bypass enqueueFeedFanOut/parseAudience here because the remote server
    // has already resolved exact recipients — no audience parsing needed.
    let fanOutCount = 0;
    const fanOutOps = [];

    for (const { itemId, to: recipientIds } of recipients) {
      if (!upsertedIds.has(itemId)) continue;
      const feedItem = feedItemMap.get(itemId);
      if (!feedItem) continue;

      for (const userId of recipientIds) {
        const hash = dedupeHash(itemId, userId);
        fanOutOps.push({
          updateOne: {
            filter: { dedupeHash: hash },
            update: {
              $setOnInsert: {
                feedItemId: itemId,
                objectType: feedItem.objectType,
                actorId: feedItem.actorId,
                to: userId,
                groupId: null,
                reason: "circle",
                canReply: feedItem.canReply || "public",
                canReact: feedItem.canReact || "public",
                dedupeHash: hash,
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (fanOutOps.length > 0) {
      try {
        const result = await FeedFanOut.bulkWrite(fanOutOps);
        fanOutCount = result.upsertedCount || 0;
      } catch (err) {
        logger.error("pullFromRemote: FeedFanOut bulkWrite failed", {
          remoteDomain,
          error: err.message,
        });
      }
    }

    logger.info("pullFromRemote: Enqueued FeedFanOut entries", {
      remoteDomain,
      fanOutCount,
    });

    return { items, nextCursor, error: null };
  } catch (error) {
    logger.error("pullFromRemote: Error", {
      remoteDomain,
      error: error.message,
      stack: error.stack,
    });
    return { items: [], nextCursor: null, error: error.message };
  }
}
