#!/usr/bin/env node
// /workers/federationPull.js
// Simplified background worker for pre-caching remote content
// Polls remote servers periodically to keep local FeedItems fresh

import "dotenv/config";
import mongoose from "mongoose";
import { User, Circle, FederatedServer, Settings } from "#schema";
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

// A bare-server member looks like "@kowloon.network" (one @ at start, no second @).
// A user member looks like "@alice@kowloon.network" (two @s).
function isServerEntry(id) {
  return typeof id === "string" && id.startsWith("@") && !id.slice(1).includes("@");
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
  };

  // Get all local users
  const localUsers = await User.find({
    id: new RegExp(`@${ourDomain}$`, "i"),
    deletedAt: null,
    active: { $ne: false },
  })
    .select("id circles")
    .lean();

  for (const user of localUsers) {
    // Add user as member (for Circle-addressed content)
    aggregated.members.add(user.id);

    // Get users they follow from remote server
    if (user.circles?.following) {
      const followingCircle = await Circle.findOne({ id: user.circles.following })
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
    if (user.circles?.groups) {
      const groupsCircle = await Circle.findOne({ id: user.circles.groups })
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

  }

  return {
    authors: Array.from(aggregated.authors),
    members: Array.from(aggregated.members),
    groups: Array.from(aggregated.groups),
  };
}

/**
 * Pull content from servers that users have added directly to circles as bare @domain entries.
 *
 * This is how the "subscribe to a whole server" feature works: a user adds e.g.
 * "@kowloon.network" (no username) to one of their circles. That tells the pull
 * worker to fetch all public posts from that server and deliver them to that user
 * whenever their circle timeline is loaded.
 *
 * Each unique domain found is pulled at most once per cycle. The FederatedServer
 * record is upserted so we track health/rate-limiting the same as for individual
 * user follows.
 */
async function processCircleServerPulls() {
  const { domain: ourDomain } = getServerSettings();
  const now = new Date();

  // Find all non-system circles that have at least one bare @domain member
  const circles = await Circle.find({
    type: { $ne: "System" },
    "members.id": { $regex: /^@[^@]+$/ },
  })
    .select("actorId members")
    .lean();

  if (!circles.length) return;

  // Map: domain -> Set of local user actorIds who have that server in a circle
  const domainToUsers = new Map();
  for (const circle of circles) {
    for (const member of circle.members) {
      if (!isServerEntry(member.id)) continue;
      const domain = member.id.slice(1); // "@kowloon.network" -> "kowloon.network"
      if (domain === ourDomain) continue; // never pull from ourselves
      if (!domainToUsers.has(domain)) domainToUsers.set(domain, new Set());
      domainToUsers.get(domain).add(circle.actorId);
    }
  }

  if (!domainToUsers.size) return;

  logger.info(`federationPull: Circle-server pull — ${domainToUsers.size} server(s)`);

  for (const [domain, userIds] of domainToUsers.entries()) {
    // Respect blocked status and nextPullAt from any previous interaction
    const serverRecord = await FederatedServer.findOne({ domain }).lean();
    if (serverRecord?.status === "blocked") continue;
    if (serverRecord?.nextPullAt && serverRecord.nextPullAt > now) continue;

    logger.info(`federationPull: Pulling circle-server ${domain}`, { users: userIds.size });

    try {
      const startTime = Date.now();
      const result = await Kowloon.federation.pullFromRemote({
        remoteDomain: domain,
        from: [`@${domain}`],
        to: [...userIds],
        since: serverRecord?.lastPulledAt ?? null,
        limit: 100,
      });
      const responseTimeMs = Date.now() - startTime;
      const itemCount = result.items?.length || 0;

      if (!result.error) {
        await FederatedServer.findOneAndUpdate(
          { domain },
          {
            $set: {
              lastPulledAt: now,
              lastPullAttemptedAt: now,
              pullErrorCount: 0,
              status: "active",
              nextPullAt: new Date(now.getTime() + POLL_INTERVAL_MS),
            },
            $setOnInsert: { domain },
          },
          { upsert: true }
        );
        logger.info(`federationPull: Circle-server ${domain} complete`, { items: itemCount, responseTimeMs });
      } else {
        await FederatedServer.findOneAndUpdate(
          { domain },
          {
            $set: { lastPullAttemptedAt: now },
            $inc: { pullErrorCount: 1 },
            $setOnInsert: { domain, status: "active" },
          },
          { upsert: true }
        );
        logger.warn(`federationPull: Circle-server ${domain} error`, { error: result.error });
      }
    } catch (error) {
      logger.error(`federationPull: Circle-server ${domain} exception`, { error: error.message });
    }
  }
}

/**
 * Process one batch of servers
 */
async function processBatch() {
  const now = new Date();

  // Get servers ready to be polled using new FederatedServer model
  const servers = await FederatedServer.getServersReadyForPull(BATCH_SIZE);

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
        params.groups.length === 0
      ) {
        logger.info(`federationPull: No local interest in ${remoteDomain}`);

        // Update nextPullAt to avoid re-checking too soon
        await FederatedServer.findOneAndUpdate(
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

      // Pull from remote server.
      // from = individual authors + group IDs to pull content for
      // to   = local user IDs who should receive the content
      const startTime = Date.now();
      const result = await Kowloon.federation.pullFromRemote({
        remoteDomain,
        from: [...params.authors, ...params.groups],
        to: params.members,
        since: server.lastPulledAt,
        limit: 100,
      });
      const responseTimeMs = Date.now() - startTime;

      const itemCount = result.items?.length || 0;
      totalItems += itemCount;

      // Update server using FederatedServer methods
      if (!result.error) {
        await FederatedServer.recordPullSuccess(remoteDomain, itemCount, responseTimeMs);
      } else {
        await FederatedServer.recordPullError(remoteDomain, result.error);
      }

      logger.info(`federationPull: Completed ${remoteDomain}`, {
        items: itemCount,
        responseTimeMs,
        error: result.error,
      });
    } catch (error) {
      logger.error(`federationPull: Error processing ${remoteDomain}`, {
        error: error.message,
        stack: error.stack,
      });

      // Update server with error using FederatedServer
      await FederatedServer.recordPullError(remoteDomain, error.message);
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
      await processCircleServerPulls();

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

export default { run, processBatch, buildPullParamsForServer, processCircleServerPulls };
