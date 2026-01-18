#!/usr/bin/env node
// /workers/federationPull.js
// Simplified background worker for pre-caching remote content
// Polls remote servers periodically to keep local FeedItems fresh

import "dotenv/config";
import mongoose from "mongoose";
import { User, Circle, Server, Settings } from "#schema";
import { loadSettings } from "#methods/settings/cache.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import Kowloon from "#kowloon";
import logger from "#methods/utils/logger.js";

const POLL_INTERVAL_MS = parseInt(process.env.FEDERATION_PULL_INTERVAL_MS || "60000", 10); // 1 minute
const BATCH_SIZE = parseInt(process.env.FEDERATION_PULL_BATCH_SIZE || "10", 10);

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
 * Build aggregated pull parameters for a remote server
 * Combines all local users' interests in that server
 */
async function buildPullParamsForServer(remoteDomain) {
  const { domain: ourDomain } = getServerSettings();

  const aggregated = {
    authors: new Set(),
    members: new Set(),
    groups: new Set(),
    events: new Set(),
  };

  // Get all local users
  const localUsers = await User.find({
    id: new RegExp(`@${ourDomain}$`, "i"),
    deletedAt: null,
    active: { $ne: false },
  })
    .select("id following groups events")
    .lean();

  for (const user of localUsers) {
    // Add user as member (for Circle-addressed content)
    aggregated.members.add(user.id);

    // Get users they follow from remote server
    if (user.following) {
      const followingCircle = await Circle.findOne({ id: user.following })
        .select("members")
        .lean();

      if (followingCircle?.members) {
        for (const member of followingCircle.members) {
          const memberDomain = extractDomain(member.id);
          if (memberDomain === remoteDomain) {
            aggregated.authors.add(member.id);
          }
        }
      }
    }

    // Get groups they're in on remote server
    if (user.groups) {
      const groupsCircle = await Circle.findOne({ id: user.groups })
        .select("members")
        .lean();

      if (groupsCircle?.members) {
        for (const member of groupsCircle.members) {
          if (member.id?.startsWith("group:") && extractDomain(member.id) === remoteDomain) {
            aggregated.groups.add(member.id);
          }
        }
      }
    }

    // Get events they're attending on remote server
    if (user.events) {
      const eventsCircle = await Circle.findOne({ id: user.events })
        .select("members")
        .lean();

      if (eventsCircle?.members) {
        for (const member of eventsCircle.members) {
          if (member.id?.startsWith("event:") && extractDomain(member.id) === remoteDomain) {
            aggregated.events.add(member.id);
          }
        }
      }
    }
  }

  return {
    authors: Array.from(aggregated.authors),
    members: Array.from(aggregated.members),
    groups: Array.from(aggregated.groups),
    events: Array.from(aggregated.events),
  };
}

/**
 * Process one batch of servers
 */
async function processBatch() {
  const now = new Date();

  // Get servers ready to be polled
  const servers = await Server.find({
    status: { $ne: "blocked" },
    $or: [{ nextPullAt: { $lte: now } }, { nextPullAt: { $exists: false } }],
  })
    .sort({ nextPullAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  if (servers.length === 0) {
    logger.info("federationPull: No servers ready to poll");
    return 0;
  }

  logger.info(`federationPull: Processing ${servers.length} servers`);

  let totalItems = 0;

  for (const server of servers) {
    const remoteDomain = server.domain;

    try {
      // Build aggregated pull parameters
      const params = await buildPullParamsForServer(remoteDomain);

      // Skip if no local interest
      if (
        params.authors.length === 0 &&
        params.members.length === 0 &&
        params.groups.length === 0 &&
        params.events.length === 0
      ) {
        logger.info(`federationPull: No local interest in ${remoteDomain}`);

        // Update nextPullAt to avoid re-checking too soon
        await Server.findOneAndUpdate(
          { domain: remoteDomain },
          {
            $set: {
              nextPullAt: new Date(Date.now() + 3600000), // 1 hour
              lastPullAttemptedAt: now,
            },
          }
        );
        continue;
      }

      // Pull from remote server
      const result = await Kowloon.federation.pullFromRemote({
        remoteDomain,
        authors: params.authors,
        members: params.members,
        groups: params.groups,
        events: params.events,
        since: server.lastPulledAt, // Only get items since last pull
        limit: 100,
        createFeedLUT: true, // Create Feed entries for all relevant members
      });

      totalItems += result.items?.length || 0;

      // Update server metadata
      const updateData = {
        lastPullAttemptedAt: now,
      };

      if (!result.error) {
        updateData.lastPulledAt = now;
        updateData.pullErrorCount = 0;
        updateData.lastPullError = null;
        // Next pull: 5min if items found, 15min if empty
        updateData.nextPullAt = new Date(
          Date.now() + (result.items?.length > 0 ? 300000 : 900000)
        );
      } else {
        updateData.pullErrorCount = (server.pullErrorCount || 0) + 1;
        updateData.lastPullError = result.error;
        // Exponential backoff: 5min, 15min, 30min, 1hr, 2hr (max)
        const backoffMinutes = Math.min(5 * Math.pow(2, updateData.pullErrorCount - 1), 120);
        updateData.nextPullAt = new Date(Date.now() + backoffMinutes * 60000);
      }

      await Server.findOneAndUpdate({ domain: remoteDomain }, { $set: updateData });

      logger.info(`federationPull: Completed ${remoteDomain}`, {
        items: result.items?.length || 0,
        error: result.error,
      });
    } catch (error) {
      logger.error(`federationPull: Error processing ${remoteDomain}`, {
        error: error.message,
        stack: error.stack,
      });

      // Update server with error
      await Server.findOneAndUpdate(
        { domain: remoteDomain },
        {
          $set: {
            lastPullAttemptedAt: now,
            pullErrorCount: (server.pullErrorCount || 0) + 1,
            lastPullError: error.message,
            nextPullAt: new Date(Date.now() + 900000), // 15 min retry
          },
        }
      );
    }
  }

  return totalItems;
}

/**
 * Main worker loop
 */
async function run() {
  logger.info("federationPull: Worker starting", {
    pollInterval: POLL_INTERVAL_MS,
    batchSize: BATCH_SIZE,
  });

  while (true) {
    try {
      const itemCount = await processBatch();

      if (itemCount > 0) {
        logger.info(`federationPull: Retrieved ${itemCount} items`);
      }
    } catch (error) {
      logger.error("federationPull: Batch error", {
        error: error.message,
        stack: error.stack,
      });
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGO_URL ||
      process.env.MONGODB_URI ||
      process.env.DATABASE_URL ||
      "mongodb://localhost:27017/kowloon";

    await mongoose.connect(mongoUri);
    logger.info("federationPull: Connected to MongoDB");

    // Load settings cache
    await loadSettings(Settings);
    logger.info("federationPull: Settings loaded");

    // Start worker loop
    await run();
  } catch (error) {
    logger.error("federationPull: Fatal error", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("federationPull: Shutting down");
  await mongoose.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("federationPull: Shutting down");
  await mongoose.disconnect();
  process.exit(0);
});

// Start worker if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default { run, processBatch, buildPullParamsForServer };
