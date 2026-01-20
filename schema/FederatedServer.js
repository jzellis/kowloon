// schema/FederatedServer.js
// Tracks federated servers for efficient batch pulls and health monitoring

import mongoose from "mongoose";
const Schema = mongoose.Schema;

const FederatedServerSchema = new Schema(
  {
    // Identification
    domain: { type: String, required: true, unique: true, index: true },
    baseUrl: { type: String }, // e.g., https://mastodon.social

    // Server metadata (from nodeinfo/webfinger)
    software: { type: String }, // e.g., "mastodon", "kowloon", "pixelfed"
    version: { type: String },

    // Usage statistics
    localFollowerCount: { type: Number, default: 0 }, // # of local users following remote users on this server
    localMemberCount: { type: Number, default: 0 }, // # of local users in groups/events on this server
    remoteUserCount: { type: Number, default: 0 }, // # of cached remote users from this server

    // Pull scheduling
    lastPulledAt: { type: Date },
    lastPullAttemptedAt: { type: Date },
    nextPullAt: { type: Date, index: true }, // For efficient batch selection
    pullIntervalMs: { type: Number, default: 300000 }, // 5 minutes default, can adjust based on activity

    // Health tracking
    status: {
      type: String,
      enum: ["active", "slow", "unreachable", "blocked", "suspended"],
      default: "active",
      index: true,
    },
    pullErrorCount: { type: Number, default: 0 },
    lastPullError: { type: String },
    lastSuccessfulPullAt: { type: Date },

    // Push federation (inbox delivery)
    lastPushAt: { type: Date },
    lastPushAttemptedAt: { type: Date },
    pushErrorCount: { type: Number, default: 0 },
    lastPushError: { type: String },

    // Performance metrics
    avgResponseTimeMs: { type: Number },

    // Admin controls
    blockedAt: { type: Date },
    blockedReason: { type: String },
    notes: { type: String }, // Admin notes
  },
  { timestamps: true }
);

// Indexes for efficient queries
FederatedServerSchema.index({ status: 1, nextPullAt: 1 }); // For batch pull selection
FederatedServerSchema.index({ localFollowerCount: 1 }); // For cleanup

// Static methods

/**
 * Increment follower count when local user follows remote user
 * @param {string} domain - Remote server domain
 */
FederatedServerSchema.statics.incrementFollowers = async function (domain) {
  if (!domain) return;

  await this.findOneAndUpdate(
    { domain },
    {
      $inc: { localFollowerCount: 1 },
      $setOnInsert: {
        status: "active",
        nextPullAt: new Date(), // Pull immediately for new servers
        pullIntervalMs: 300000, // 5 minutes
      },
    },
    { upsert: true }
  );
};

/**
 * Decrement follower count when local user unfollows remote user
 * @param {string} domain - Remote server domain
 */
FederatedServerSchema.statics.decrementFollowers = async function (domain) {
  if (!domain) return;

  const server = await this.findOneAndUpdate(
    { domain },
    { $inc: { localFollowerCount: -1 } },
    { new: true }
  );

  // If no more local followers, stop polling this server
  if (server && server.localFollowerCount <= 0 && server.localMemberCount <= 0) {
    await this.findByIdAndUpdate(server._id, {
      nextPullAt: null, // Stop polling
    });
  }
};

/**
 * Increment member count when local user joins remote group/event
 * @param {string} domain - Remote server domain
 */
FederatedServerSchema.statics.incrementMembers = async function (domain) {
  if (!domain) return;

  await this.findOneAndUpdate(
    { domain },
    {
      $inc: { localMemberCount: 1 },
      $setOnInsert: {
        status: "active",
        nextPullAt: new Date(),
        pullIntervalMs: 300000,
      },
    },
    { upsert: true }
  );
};

/**
 * Decrement member count when local user leaves remote group/event
 * @param {string} domain - Remote server domain
 */
FederatedServerSchema.statics.decrementMembers = async function (domain) {
  if (!domain) return;

  const server = await this.findOneAndUpdate(
    { domain },
    { $inc: { localMemberCount: -1 } },
    { new: true }
  );

  // If no more local interest, stop polling
  if (server && server.localFollowerCount <= 0 && server.localMemberCount <= 0) {
    await this.findByIdAndUpdate(server._id, {
      nextPullAt: null,
    });
  }
};

/**
 * Record successful pull and adjust polling interval
 * @param {string} domain - Remote server domain
 * @param {number} itemCount - Number of items retrieved
 * @param {number} responseTimeMs - Response time in milliseconds
 */
FederatedServerSchema.statics.recordPullSuccess = async function (
  domain,
  itemCount,
  responseTimeMs
) {
  if (!domain) return;

  const now = new Date();

  // Adjust interval based on activity:
  // - High activity (10+ items): poll every 5 minutes
  // - Medium activity (1-9 items): poll every 10 minutes
  // - No new items: poll every 15 minutes
  let pullIntervalMs = 900000; // 15 minutes default
  if (itemCount >= 10) {
    pullIntervalMs = 300000; // 5 minutes
  } else if (itemCount > 0) {
    pullIntervalMs = 600000; // 10 minutes
  }

  const update = {
    lastPulledAt: now,
    lastSuccessfulPullAt: now,
    lastPullAttemptedAt: now,
    pullErrorCount: 0,
    lastPullError: null,
    pullIntervalMs,
    nextPullAt: new Date(now.getTime() + pullIntervalMs),
    status: "active",
  };

  // Update average response time (exponential moving average)
  if (responseTimeMs) {
    const server = await this.findOne({ domain }).select("avgResponseTimeMs").lean();
    if (server?.avgResponseTimeMs) {
      // Weighted average: 70% old, 30% new
      update.avgResponseTimeMs = Math.round(
        server.avgResponseTimeMs * 0.7 + responseTimeMs * 0.3
      );
    } else {
      update.avgResponseTimeMs = responseTimeMs;
    }
  }

  await this.findOneAndUpdate({ domain }, update, { upsert: true });
};

/**
 * Record failed pull and implement exponential backoff
 * @param {string} domain - Remote server domain
 * @param {string} error - Error message
 */
FederatedServerSchema.statics.recordPullError = async function (domain, error) {
  if (!domain) return;

  const server = await this.findOne({ domain });
  const errorCount = (server?.pullErrorCount || 0) + 1;

  // Exponential backoff: 5min, 15min, 30min, 1hr, 2hr (max)
  const backoffMs = Math.min(300000 * Math.pow(2, errorCount - 1), 7200000);

  // Determine status based on error count
  let status = "active";
  if (errorCount >= 10) {
    status = "unreachable";
  } else if (errorCount >= 5) {
    status = "slow";
  }

  await this.findOneAndUpdate(
    { domain },
    {
      $inc: { pullErrorCount: 1 },
      lastPullError: error.substring(0, 500), // Limit error message length
      lastPullAttemptedAt: new Date(),
      nextPullAt: new Date(Date.now() + backoffMs),
      status,
    },
    { upsert: true }
  );
};

/**
 * Record successful push to remote server
 * @param {string} domain - Remote server domain
 */
FederatedServerSchema.statics.recordPushSuccess = async function (domain) {
  if (!domain) return;

  await this.findOneAndUpdate(
    { domain },
    {
      lastPushAt: new Date(),
      lastPushAttemptedAt: new Date(),
      pushErrorCount: 0,
      lastPushError: null,
    },
    { upsert: true }
  );
};

/**
 * Record failed push to remote server
 * @param {string} domain - Remote server domain
 * @param {string} error - Error message
 */
FederatedServerSchema.statics.recordPushError = async function (domain, error) {
  if (!domain) return;

  await this.findOneAndUpdate(
    { domain },
    {
      $inc: { pushErrorCount: 1 },
      lastPushError: error.substring(0, 500),
      lastPushAttemptedAt: new Date(),
    },
    { upsert: true }
  );
};

/**
 * Get servers ready for pulling (batch selection)
 * @param {number} limit - Maximum number of servers to return
 * @returns {Promise<Array>}
 */
FederatedServerSchema.statics.getServersReadyForPull = async function (
  limit = 10
) {
  const now = new Date();

  return this.find({
    status: { $in: ["active", "slow"] }, // Don't pull from unreachable/blocked
    nextPullAt: { $lte: now },
    $or: [
      { localFollowerCount: { $gt: 0 } },
      { localMemberCount: { $gt: 0 } },
    ],
  })
    .sort({ nextPullAt: 1 }) // Oldest first
    .limit(limit)
    .lean();
};

/**
 * Block a server (admin action)
 * @param {string} domain - Domain to block
 * @param {string} reason - Reason for blocking
 */
FederatedServerSchema.statics.blockServer = async function (domain, reason) {
  await this.findOneAndUpdate(
    { domain },
    {
      status: "blocked",
      blockedAt: new Date(),
      blockedReason: reason,
      nextPullAt: null, // Stop pulling
    },
    { upsert: true }
  );
};

/**
 * Unblock a server (admin action)
 * @param {string} domain - Domain to unblock
 */
FederatedServerSchema.statics.unblockServer = async function (domain) {
  await this.findOneAndUpdate(
    { domain },
    {
      status: "active",
      blockedAt: null,
      blockedReason: null,
      nextPullAt: new Date(), // Resume pulling immediately
      pullErrorCount: 0,
    }
  );
};

const FederatedServer = mongoose.model("FederatedServer", FederatedServerSchema);
export default FederatedServer;
