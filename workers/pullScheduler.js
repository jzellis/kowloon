#!/usr/bin/env node
// workers/pullScheduler.js
// Pull-based federation scheduler
// Polls remote servers based on Server.scheduler.nextPollAt

import "dotenv/config";
import mongoose from "mongoose";
import Server from "../schema/Server.js";
import { loadSettings } from "../methods/settings/cache.js";
import Settings from "../schema/Settings.js";
import logger from "../methods/utils/logger.js";
import pullFromServerMethod from "../methods/federation/pullFromServer.js";

const POLL_INTERVAL_MS = Number(process.env.PULL_SCHEDULER_INTERVAL) || 10000; // 10 seconds
const BATCH_SIZE = Number(process.env.PULL_SCHEDULER_BATCH_SIZE) || 5; // Pull from 5 servers per tick
const NEXT_POLL_DELAY_MS = Number(process.env.PULL_NEXT_POLL_DELAY_MS) || 300000; // 5 minutes default

let running = false;

/**
 * Pull from a single remote server
 */
async function pullFromServer(server) {
  const domain = server.domain;
  const serverId = server.id;

  try {
    logger.info(`Pull scheduler: polling ${domain}`, {
      serverId,
      actorsCount: server.actorsRefCount?.size || 0,
      serverFollowersCount: server.serverFollowersCount || 0,
    });

    // Use the pullFromServer method directly
    const result = await pullFromServerMethod(domain, {
      limit: server.maxPage || 100,
    });

    // Check if pull succeeded
    if (result.error) {
      throw new Error(result.error);
    }

    // Pull succeeded - update server (note: pullFromServer already updated cursors)
    logger.info(`Pull scheduler: ${domain} completed`, {
      serverId,
      ingested: result.result?.ingested || 0,
      filtered: result.result?.filtered || 0,
    });
  } catch (err) {
    logger.error(`Pull scheduler: ${domain} failed`, {
      serverId,
      error: err.message,
    });
  }
}

/**
 * Main polling loop
 */
async function tick() {
  if (running) {
    logger.warn("Pull scheduler: tick already running, skipping");
    return;
  }

  running = true;

  try {
    const now = new Date();

    // Find servers due for polling
    const servers = await Server.find({
      status: { $nin: ["blocked", "muted"] },
      $or: [
        { "scheduler.nextPollAt": { $exists: false } },
        { "scheduler.nextPollAt": { $lte: now } },
      ],
    })
      .sort({ "scheduler.nextPollAt": 1 }) // Poll oldest first
      .limit(BATCH_SIZE)
      .lean();

    if (servers.length === 0) {
      logger.debug("Pull scheduler: no servers due for polling");
      return;
    }

    logger.info(`Pull scheduler: found ${servers.length} servers to poll`);

    // Poll servers sequentially to avoid overloading
    for (const server of servers) {
      await pullFromServer(server);
    }
  } catch (err) {
    logger.error("Pull scheduler: tick error", { error: err.message, stack: err.stack });
  } finally {
    running = false;
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Check multiple env variable names for MongoDB URI (match main server behavior)
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGO_URL ||
      process.env.MONGODB_URI ||
      process.env.DATABASE_URL ||
      "mongodb://localhost:27017/kowloon";

    await mongoose.connect(mongoUri);
    logger.info("Pull scheduler: Connected to MongoDB");

    await loadSettings(Settings);
    logger.info("Pull scheduler: Settings cache loaded");

    logger.info(`Pull scheduler: Starting (interval: ${POLL_INTERVAL_MS}ms, batch: ${BATCH_SIZE})`);

    // Run first tick immediately
    await tick();

    // Schedule subsequent ticks
    setInterval(tick, POLL_INTERVAL_MS);
  } catch (err) {
    logger.error("Pull scheduler: Failed to start", { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Pull scheduler: Received SIGINT, shutting down...");
  await mongoose.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Pull scheduler: Received SIGTERM, shutting down...");
  await mongoose.disconnect();
  process.exit(0);
});

// Start the worker
main();
