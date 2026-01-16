// /workers/federationPull.js
// Background worker that proactively pulls content from remote servers
// Keeps local FeedItems cache fresh for remote content

import Kowloon from "#kowloon";
import { Circle, User, FeedItems, Server } from "#schema";
import logger from "#methods/utils/logger.js";
import fetch from "node-fetch";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

const POLL_INTERVAL_MS = Number(process.env.FEDERATION_PULL_INTERVAL_MS) || 60000; // 1 minute default
const BATCH_SIZE = Number(process.env.FEDERATION_PULL_BATCH_SIZE) || 10; // Servers per batch

/**
 * Extract domain from actor ID or URL
 */
function extractDomain(str) {
  if (!str) return null;
  try {
    const url = new URL(str);
    return url.hostname;
  } catch {
    const parts = str.split('@').filter(Boolean);
    return parts[parts.length - 1];
  }
}

/**
 * Gather pull parameters for a specific remote server
 * Returns what content local users want from this remote server
 */
async function buildPullParams(remoteDomain) {
  const { domain: ourDomain } = getServerSettings();

  const params = {
    members: new Set(),
    authors: new Set(),
    groups: new Set(),
    events: new Set(),
  };

  // Find all local users
  const localUsers = await User.find({
    id: new RegExp(`@${ourDomain}$`, 'i'),
    deletedAt: null
  })
    .select('id following allFollowing groups events')
    .lean();

  logger.info(`buildPullParams: Found ${localUsers.length} local users`);

  for (const user of localUsers) {
    // Get user's following Circle (people they follow)
    if (user.following) {
      const followingCircle = await Circle.findOne({ id: user.following })
        .select('members')
        .lean();

      if (followingCircle?.members) {
        for (const member of followingCircle.members) {
          const memberDomain = extractDomain(member.id);
          if (memberDomain === remoteDomain) {
            // User follows someone on this remote server
            params.authors.add(member.id);
            params.members.add(user.id); // Include user as member filter
          }
        }
      }
    }

    // Get user's groups Circle (groups they're in)
    if (user.groups) {
      const groupsCircle = await Circle.findOne({ id: user.groups })
        .select('members')
        .lean();

      if (groupsCircle?.members) {
        for (const member of groupsCircle.members) {
          const memberDomain = extractDomain(member.id);
          if (memberDomain === remoteDomain) {
            // User is in a group on this remote server
            params.groups.add(member.id);
            params.members.add(user.id);
          }
        }
      }
    }

    // Get user's events Circle (events they're attending)
    if (user.events) {
      const eventsCircle = await Circle.findOne({ id: user.events })
        .select('members')
        .lean();

      if (eventsCircle?.members) {
        for (const member of eventsCircle.members) {
          const memberDomain = extractDomain(member.id);
          if (memberDomain === remoteDomain) {
            // User is attending an event on this remote server
            params.events.add(member.id);
            params.members.add(user.id);
          }
        }
      }
    }
  }

  return {
    members: Array.from(params.members),
    authors: Array.from(params.authors),
    groups: Array.from(params.groups),
    events: Array.from(params.events),
  };
}

/**
 * Pull content from a remote server
 */
async function pullFromServer(remoteDomain, params, since) {
  try {
    // Build query string
    const queryParams = new URLSearchParams();
    if (params.members?.length) params.members.forEach(m => queryParams.append('members', m));
    if (params.authors?.length) params.authors.forEach(a => queryParams.append('authors', a));
    if (params.groups?.length) params.groups.forEach(g => queryParams.append('groups', g));
    if (params.events?.length) params.events.forEach(e => queryParams.append('events', e));
    if (since) queryParams.append('since', new Date(since).toISOString());
    queryParams.append('limit', '100');

    const url = `https://${remoteDomain}/.well-known/kowloon/pull?${queryParams}`;

    logger.info("pullFromServer: Fetching", {
      domain: remoteDomain,
      members: params.members?.length || 0,
      authors: params.authors?.length || 0,
      groups: params.groups?.length || 0,
      events: params.events?.length || 0,
    });

    // TODO: Sign request with HTTP Signature
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/activity+json',
      },
      timeout: 30000, // 30 second timeout
    });

    if (!response.ok) {
      logger.error("pullFromServer: HTTP error", {
        domain: remoteDomain,
        status: response.status,
        statusText: response.statusText,
      });
      return { items: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const items = data.orderedItems || data.items || [];

    logger.info("pullFromServer: Success", {
      domain: remoteDomain,
      count: items.length,
    });

    // Upsert items into FeedItems
    let upserted = 0;
    for (const item of items) {
      try {
        await FeedItems.findOneAndUpdate(
          { id: item.id },
          { $set: item },
          { upsert: true, new: true }
        );
        upserted++;
      } catch (err) {
        logger.error("pullFromServer: Upsert failed", {
          domain: remoteDomain,
          itemId: item.id,
          error: err.message,
        });
      }
    }

    logger.info("pullFromServer: Upserted", {
      domain: remoteDomain,
      total: items.length,
      upserted,
    });

    return {
      items,
      nextCursor: data.next,
    };
  } catch (error) {
    logger.error("pullFromServer: Error", {
      domain: remoteDomain,
      error: error.message,
      stack: error.stack,
    });
    return { items: [], error: error.message };
  }
}

/**
 * Process one batch of servers
 */
async function processBatch() {
  try {
    // Get servers that are ready to be polled
    const now = new Date();
    const servers = await Server.find({
      status: { $ne: 'blocked' },
      $or: [
        { nextPullAt: { $lte: now } },
        { nextPullAt: { $exists: false } },
      ],
    })
      .sort({ nextPullAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (servers.length === 0) {
      logger.info("processBatch: No servers ready to poll");
      return 0;
    }

    logger.info(`processBatch: Processing ${servers.length} servers`);

    let totalItems = 0;

    for (const server of servers) {
      const remoteDomain = server.domain;

      // Build pull parameters based on what local users want from this server
      const params = await buildPullParams(remoteDomain);

      // Skip if no local users have any interest in this server
      if (params.members.length === 0 &&
          params.authors.length === 0 &&
          params.groups.length === 0 &&
          params.events.length === 0) {
        logger.info(`processBatch: Skipping ${remoteDomain} - no local interest`);

        // Update nextPullAt to avoid re-checking too soon
        await Server.findOneAndUpdate(
          { domain: remoteDomain },
          {
            $set: {
              nextPullAt: new Date(Date.now() + 3600000), // 1 hour
              lastPullAttemptedAt: now,
            }
          }
        );
        continue;
      }

      // Pull from server
      const result = await pullFromServer(
        remoteDomain,
        params,
        server.lastPulledAt // Only get items since last pull
      );

      totalItems += result.items?.length || 0;

      // Update server metadata
      const updateData = {
        lastPullAttemptedAt: now,
      };

      if (!result.error) {
        updateData.lastPulledAt = now;
        updateData.pullErrorCount = 0;
        // Next pull in 5 minutes if we got items, 15 minutes if empty
        updateData.nextPullAt = new Date(Date.now() + (result.items?.length > 0 ? 300000 : 900000));
      } else {
        updateData.pullErrorCount = (server.pullErrorCount || 0) + 1;
        updateData.lastPullError = result.error;
        // Exponential backoff: 5min, 15min, 30min, 1hr, 2hr (max)
        const backoffMinutes = Math.min(5 * Math.pow(2, updateData.pullErrorCount - 1), 120);
        updateData.nextPullAt = new Date(Date.now() + backoffMinutes * 60000);
      }

      await Server.findOneAndUpdate(
        { domain: remoteDomain },
        { $set: updateData }
      );
    }

    logger.info(`processBatch: Completed`, {
      serversProcessed: servers.length,
      totalItems,
    });

    return totalItems;
  } catch (error) {
    logger.error("processBatch: Fatal error", {
      error: error.message,
      stack: error.stack,
    });
    return 0;
  }
}

/**
 * Main worker loop
 */
async function run() {
  logger.info("Federation pull worker starting", {
    pollInterval: POLL_INTERVAL_MS,
    batchSize: BATCH_SIZE,
  });

  while (true) {
    try {
      const itemCount = await processBatch();

      if (itemCount > 0) {
        logger.info(`Federation pull: Retrieved ${itemCount} items`);
      }
    } catch (error) {
      logger.error("Federation pull worker error", {
        error: error.message,
        stack: error.stack,
      });
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Start worker if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(error => {
    logger.error("Federation pull worker crashed", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
}

export default { run, processBatch, buildPullParams, pullFromServer };
