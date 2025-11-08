#!/usr/bin/env node
// workers/pullScheduler.js
// Pull-based federation scheduler
// Polls remote servers based on Server.scheduler.nextPollAt

import "dotenv/config";
import mongoose from "mongoose";
import Server from "../schema/Server.js";
import { loadSettings } from "../methods/settings/cache.js";
import Settings from "../schema/Settings.js";
import fetch from "node-fetch";
import logger from "../methods/utils/logger.js";

const POLL_INTERVAL_MS = Number(process.env.PULL_SCHEDULER_INTERVAL) || 10000; // 10 seconds
const BATCH_SIZE = Number(process.env.PULL_SCHEDULER_BATCH_SIZE) || 5; // Pull from 5 servers per tick
const NEXT_POLL_DELAY_MS = Number(process.env.PULL_NEXT_POLL_DELAY_MS) || 300000; // 5 minutes default

let running = false;
let systemToken = null;

/**
 * Generate a system JWT token for internal API calls
 */
async function getSystemToken() {
  if (systemToken) return systemToken;

  const jwt = await import("jsonwebtoken");
  const { getSetting } = await import("../methods/settings/cache.js");

  const domain = getSetting("domain");
  const privateKey = getSetting("privateKey");

  if (!domain || !privateKey) {
    throw new Error("Missing domain or privateKey in settings");
  }

  const payload = {
    iss: `https://${domain}`,
    sub: `@${domain}`,
    scope: "system:pull-scheduler",
    iat: Math.floor(Date.now() / 1000),
    // Long-lived token for worker
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  };

  systemToken = jwt.default.sign(payload, privateKey, { algorithm: "RS256" });

  // Refresh token every 12 hours
  setTimeout(() => {
    systemToken = null;
  }, 43200000);

  return systemToken;
}

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

    const token = await getSystemToken();
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const pullUrl = `${baseUrl}/federation/pull/${domain}`;

    const response = await fetch(pullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        limit: server.maxPage || 100,
      }),
      timeout: server.timeouts?.readMs || 30000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Update server stats
    const updateData = {
      "scheduler.nextPollAt": new Date(Date.now() + NEXT_POLL_DELAY_MS),
      "scheduler.errorCount": 0,
      "scheduler.backoffMs": 0,
      "scheduler.lastSuccessfulPollAt": new Date(),
      "scheduler.lastError": null,
      "scheduler.lastErrorCode": null,
      lastSeenAt: new Date(),
    };

    if (result.result?.ingested > 0) {
      updateData["stats.itemsSeen"] = (server.stats?.itemsSeen || 0) + result.result.ingested;
      updateData["stats.lastItemAt"] = new Date();
    }

    await Server.updateOne({ _id: server._id }, { $set: updateData });

    logger.info(`Pull scheduler: ${domain} completed`, {
      serverId,
      ingested: result.result?.ingested || 0,
      filtered: result.result?.filtered || 0,
    });
  } catch (err) {
    // Handle errors with exponential backoff
    const errorCount = (server.scheduler?.errorCount || 0) + 1;
    const currentBackoff = server.scheduler?.backoffMs || 0;
    const newBackoff = Math.min(currentBackoff + 60000, 3600000); // Max 1 hour

    // Determine error code
    let errorCode = "EOTHER";
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      errorCode = "ECONN";
    } else if (err.code === "ETIMEDOUT" || err.type === "request-timeout") {
      errorCode = "ETIMEOUT";
    } else if (err.message.includes("HTTP 4") || err.message.includes("HTTP 5")) {
      errorCode = "EHTTP";
    }

    await Server.updateOne(
      { _id: server._id },
      {
        $set: {
          "scheduler.nextPollAt": new Date(Date.now() + newBackoff),
          "scheduler.errorCount": errorCount,
          "scheduler.backoffMs": newBackoff,
          "scheduler.lastError": err.message.substring(0, 500),
          "scheduler.lastErrorCode": errorCode,
        },
      }
    );

    logger.error(`Pull scheduler: ${domain} failed`, {
      serverId,
      error: err.message,
      errorCode,
      errorCount,
      nextBackoffMs: newBackoff,
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

    // Verify we have required settings
    const { getSetting } = await import("../methods/settings/cache.js");
    const domain = getSetting("domain");
    const privateKey = getSetting("privateKey");

    if (!domain) {
      throw new Error("Missing domain in settings - cannot start pull scheduler");
    }
    if (!privateKey) {
      throw new Error("Missing privateKey in settings - cannot start pull scheduler");
    }

    logger.info(`Pull scheduler: Starting (domain: ${domain}, interval: ${POLL_INTERVAL_MS}ms)`);

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
