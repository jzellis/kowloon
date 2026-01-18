#!/usr/bin/env node
// /workers/feedFanOut.js
// Background worker that processes FeedFanOut queue
// Computes audience and creates Feed entries for local viewers

import "dotenv/config";
import mongoose from "mongoose";
import {
  FeedFanOut,
  FeedItems,
  Feed,
  User,
  Circle,
  Group,
  Event,
  Settings,
} from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import { loadSettings } from "#methods/settings/cache.js";

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const BATCH_SIZE = 10; // Process 10 jobs per batch
const RETRY_DELAYS = [60, 300, 900, 3600, 7200]; // Retry delays in seconds

/**
 * Get users following the @server actor (for public posts)
 * @returns {Promise<string[]>}
 */
async function getServerFollowers() {
  const { actorId: serverActorId } = getServerSettings();
  if (!serverActorId) return [];

  // Followers are users whose "following" circle contains @server
  const users = await User.find({ deletedAt: null, active: { $ne: false } })
    .select("id circles")
    .lean();

  if (users.length === 0) return [];

  // Get all unique following circle IDs
  const followingCircleIds = users.map((u) => u.circles?.following).filter(Boolean);
  if (followingCircleIds.length === 0) return [];

  // Batch fetch all following circles
  const followingCircles = await Circle.find({
    id: { $in: followingCircleIds },
  }).lean();

  // Build map: circleId -> member IDs
  const circleMembers = new Map();
  for (const circle of followingCircles) {
    const memberIds = (circle.members || []).map((m) => m.id).filter(Boolean);
    circleMembers.set(circle.id, new Set(memberIds));
  }

  // Find users whose following circle contains @server
  const serverFollowers = [];
  for (const user of users) {
    if (!user.circles?.following) continue;
    const members = circleMembers.get(user.circles.following);
    if (members?.has(serverActorId)) {
      serverFollowers.push(user.id);
    }
  }

  return serverFollowers;
}

/**
 * Build follower map for all users (batch operation)
 * @returns {Promise<Map<string, Set<string>>>} Map: actorId -> Set of follower IDs
 */
async function buildFollowerMap() {
  const users = await User.find({ deletedAt: null, active: { $ne: false } })
    .select("id circles")
    .lean();

  if (users.length === 0) return new Map();

  // Get all unique following circle IDs
  const followingCircleIds = users.map((u) => u.circles?.following).filter(Boolean);
  if (followingCircleIds.length === 0) return new Map();

  // Batch fetch all following circles
  const followingCircles = await Circle.find({
    id: { $in: followingCircleIds },
  }).lean();

  // Build map: circleId -> member IDs
  const circleMembers = new Map();
  for (const circle of followingCircles) {
    const memberIds = (circle.members || []).map((m) => m.id).filter(Boolean);
    circleMembers.set(circle.id, memberIds);
  }

  // Build reverse map: actorId -> Set of followers
  const followerMap = new Map();
  for (const user of users) {
    if (!user.circles?.following) continue;
    const following = circleMembers.get(user.circles.following) || [];
    for (const followedId of following) {
      if (!followerMap.has(followedId)) {
        followerMap.set(followedId, new Set());
      }
      followerMap.get(followedId).add(user.id);
    }
  }

  return followerMap;
}

/**
 * Check if viewer follows author
 * @param {string} viewerId - The viewer
 * @param {string} authorId - The author
 * @param {Map<string, Set<string>>} followerMap - Pre-built follower map
 * @returns {boolean}
 */
function follows(viewerId, authorId, followerMap) {
  const followers = followerMap.get(authorId);
  return followers ? followers.has(viewerId) : false;
}

/**
 * Check if viewer is in local audience (member of addressed circles/groups/events)
 * @param {string} viewerId - The viewer
 * @param {string[]} addressedIds - LOCAL circle/group/event IDs
 * @param {Map<string, Set<string>>} membershipMap - Pre-built membership map
 * @returns {boolean}
 */
function inLocalAudience(viewerId, addressedIds, membershipMap) {
  if (!addressedIds || addressedIds.length === 0) return false;

  for (const id of addressedIds) {
    const members = membershipMap.get(id);
    if (members?.has(viewerId)) return true;
  }

  return false;
}

/**
 * Build membership map for circles/groups/events (batch operation)
 * @param {string[]} objectIds - Circle/Group/Event IDs
 * @returns {Promise<Map<string, Set<string>>>} Map: objectId -> Set of member IDs
 */
async function buildMembershipMap(objectIds) {
  if (!objectIds || objectIds.length === 0) return new Map();

  const membershipMap = new Map();

  // Group by type
  const circleIds = objectIds.filter((id) => id.startsWith("circle:"));
  const groupIds = objectIds.filter((id) => id.startsWith("group:"));
  const eventIds = objectIds.filter((id) => id.startsWith("event:"));

  // Batch fetch
  const [circles, groups, events] = await Promise.all([
    circleIds.length > 0 ? Circle.find({ id: { $in: circleIds } }).lean() : [],
    groupIds.length > 0 ? Group.find({ id: { $in: groupIds } }).lean() : [],
    eventIds.length > 0 ? Event.find({ id: { $in: eventIds } }).lean() : [],
  ]);

  // Build map
  for (const obj of [...circles, ...groups, ...events]) {
    const memberIds = (obj.members || []).map((m) => m.id).filter(Boolean);
    membershipMap.set(obj.id, new Set(memberIds));
  }

  return membershipMap;
}

/**
 * Unified capability checker
 * @param {Object} opts
 * @param {string} opts.viewerId - The viewer
 * @param {string} opts.authorId - The author
 * @param {string} opts.capability - Capability value ("public"|"followers"|"audience"|"none")
 * @param {string} opts.origin - Origin ("local"|"remote")
 * @param {string[]} opts.addressedIds - LOCAL addressed IDs
 * @param {Object} opts.grants - Remote grants object (for remote content)
 * @param {Map} opts.followerMap - Pre-built follower map
 * @param {Map} opts.membershipMap - Pre-built membership map
 * @returns {boolean}
 */
function hasCapability({
  viewerId,
  authorId,
  capability,
  origin,
  addressedIds,
  grants = {},
  followerMap,
  membershipMap,
}) {
  if (!capability || typeof capability !== "string") return false;

  const cap = capability.toLowerCase().trim();

  // "public" → always true
  if (cap === "public" || cap === "@public") return true;

  // "none" → always false
  if (cap === "none") return false;

  // "followers" → check if viewer follows author
  if (cap === "followers") {
    return follows(viewerId, authorId, followerMap);
  }

  // "audience" → depends on origin
  if (cap === "audience") {
    if (origin === "remote") {
      // Remote: use grants/token only (never resolve circles)
      return Boolean(grants[viewerId]);
    } else {
      // Local: check if viewer is in addressed circles/groups/events
      return inLocalAudience(viewerId, addressedIds, membershipMap);
    }
  }

  return false;
}

/**
 * Process a single fan-out job
 * @param {Object} job - The FeedFanOut job
 */
async function processFanOutJob(job) {
  const jobId = job.id || job._id?.toString() || "unknown";
  console.log(`Processing fan-out job ${jobId} for ${job.feedCacheId}`);

  try {
    // Mark as processing
    await FeedFanOut.findByIdAndUpdate(job._id, {
      status: "processing",
      startedAt: new Date(),
      $inc: { attempts: 1 },
    });

    // Fetch the FeedItems entry
    const feedCache = await FeedItems.findOne({ id: job.feedCacheId }).lean();
    if (!feedCache) {
      throw new Error(`FeedItems entry not found: ${job.feedCacheId}`);
    }

    // Extract job audience data
    const { to, canReply, canReact, addressedIds } = job.audience || {};
    const isPublic = to?.includes("@public") || to?.includes("public");
    const { domain } = getServerSettings();
    const isServer = to?.includes(`@${domain}`);

    // NEW ARCHITECTURE: No Feed entries for @public or @server posts
    // They are queried directly from FeedItems
    if (isPublic || isServer) {
      console.log(`Fan-out job ${jobId}: Skipping @public/@server post (no Feed LUT needed)`);
      await FeedFanOut.findByIdAndUpdate(job._id, {
        status: "completed",
        completedAt: new Date(),
        counts: { total: 0, skipped: 1, reason: "public/server post" },
      });
      return;
    }

    // Only create Feed entries for Circle/Group/Event-addressed content
    if (!addressedIds || addressedIds.length === 0) {
      console.log(`Fan-out job ${jobId}: No addressed IDs, skipping`);
      await FeedFanOut.findByIdAndUpdate(job._id, {
        status: "completed",
        completedAt: new Date(),
        counts: { total: 0, skipped: 1, reason: "no addressed containers" },
      });
      return;
    }

    // Build membership maps (batch operations)
    const membershipMap = await buildMembershipMap(addressedIds || []);

    // Collect viewer IDs and reasons
    const viewerMap = new Map(); // viewerId -> reason

    // 1. Author themselves (reason: "self")
    const isLocalAuthor = feedCache.actorId
      ?.toLowerCase()
      .endsWith(`@${domain?.toLowerCase()}`);
    if (isLocalAuthor) {
      viewerMap.set(feedCache.actorId, "self");
    }

    // 2. Audience members (reason: "audience") - Circle/Group/Event members
    for (const id of addressedIds) {
      const members = membershipMap.get(id) || new Set();
      for (const memberId of members) {
        if (!viewerMap.has(memberId)) {
          viewerMap.set(memberId, "audience");
        }
      }
    }

    // Create Feed entries
    const counts = {
      total: 0,
      followers: 0,
      audience: 0,
      domain: 0,
      self: 0,
      mentions: 0,
    };
    const feedEntries = [];

    for (const [viewerId, reason] of viewerMap.entries()) {
      // Compute per-viewer capabilities using unified hasCapability
      const canReplyBool = hasCapability({
        viewerId,
        authorId: feedCache.actorId,
        capability: canReply,
        origin,
        addressedIds,
        grants: {}, // TODO: implement remote grants from tokens
        followerMap,
        membershipMap,
      });

      const canReactBool = hasCapability({
        viewerId,
        authorId: feedCache.actorId,
        capability: canReact,
        origin,
        addressedIds,
        grants: {}, // TODO: implement remote grants from tokens
        followerMap,
        membershipMap,
      });

      const feedEntry = {
        actorId: viewerId, // The viewer
        objectId: feedCache.id, // FeedItems.id
        activityActorId: feedCache.actorId, // Object author
        type: feedCache.objectType, // Main type (e.g., "Post", "Bookmark", "Page")
        objectType: feedCache.type, // Subtype (e.g., "Note", "Article", "Folder")
        reason,
        createdAt: feedCache.publishedAt || feedCache.createdAt || new Date(),
        fetchedAt: new Date(),
        canReply: canReplyBool,
        canReact: canReactBool,
        // Optional: add snapshot for list rendering
        snapshot: {
          id: feedCache.id,
          actorId: feedCache.actorId,
          type: feedCache.type,
          objectType: feedCache.objectType,
        },
      };

      feedEntries.push(feedEntry);
      counts[reason] = (counts[reason] || 0) + 1;
      counts.total++;
    }

    // Bulk insert Feed entries (with upsert to handle duplicates)
    if (feedEntries.length > 0) {
      const bulkOps = feedEntries.map((entry) => ({
        updateOne: {
          filter: { actorId: entry.actorId, objectId: entry.objectId },
          update: { $set: entry },
          upsert: true,
        },
      }));
      await Feed.bulkWrite(bulkOps);
    }

    // Mark job as completed
    await FeedFanOut.findByIdAndUpdate(job._id, {
      status: "completed",
      completedAt: new Date(),
      counts,
    });

    console.log(
      `Fan-out job ${jobId} completed: ${counts.total} Feed entries created`,
      counts
    );
  } catch (err) {
    console.error(`Fan-out job ${jobId} failed:`, err.message);

    // Calculate next retry delay
    const retryDelay =
      RETRY_DELAYS[Math.min(job.attempts, RETRY_DELAYS.length - 1)];
    const nextAttemptAt = new Date(Date.now() + retryDelay * 1000);

    // Mark as failed if max attempts reached
    const status = job.attempts >= job.maxAttempts ? "failed" : "pending";

    await FeedFanOut.findByIdAndUpdate(job._id, {
      status,
      lastError: err.message,
      nextAttemptAt,
    });

    if (status === "failed") {
      console.error(
        `Fan-out job ${jobId} permanently failed after ${job.attempts} attempts`
      );
    }
  }
}

/**
 * Main worker loop
 */
async function run() {
  console.log("Feed fan-out worker started");

  while (true) {
    try {
      // Fetch pending jobs
      const jobs = await FeedFanOut.find({
        status: "pending",
        nextAttemptAt: { $lte: new Date() },
      })
        .sort({ createdAt: 1 }) // FIFO
        .limit(BATCH_SIZE)
        .lean();

      if (jobs.length === 0) {
        // No jobs, wait before polling again
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        continue;
      }

      console.log(`Found ${jobs.length} pending fan-out jobs`);

      // Process jobs sequentially (or use Promise.all for parallel)
      for (const job of jobs) {
        await processFanOutJob(job);
      }
    } catch (err) {
      console.error("Worker error:", err);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

// Connect to MongoDB and start worker
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
    console.log("Connected to MongoDB");

    // Load settings cache
    await loadSettings(Settings);
    console.log("Settings cache loaded");

    await run();
  } catch (err) {
    console.error("Failed to start worker:", err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await mongoose.disconnect();
  process.exit(0);
});

main();
