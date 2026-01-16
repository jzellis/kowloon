// /schema/FeedFanOut.js
// Queue for asynchronous feed fan-out jobs
// Follows the pattern established by Outbox.js for federation

import mongoose from "mongoose";
const { Schema } = mongoose;

const FeedFanOutSchema = new Schema(
  {
    // Source object to fan out
    feedCacheId: { type: String, required: true, index: true }, // FeedItems.id
    objectType: { type: String, required: true }, // Post/Reply/Event/etc
    actorId: { type: String, required: true, index: true }, // author

    // Job status
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },

    // Audience resolution snapshot (for debugging/auditing)
    audience: {
      to: { type: String }, // original "to" value
      canReply: { type: String }, // original canReply
      canReact: { type: String }, // original canReact
      addressedIds: { type: [String], default: [] }, // LOCAL circle/group/event IDs only
    },

    // Fan-out results
    counts: {
      total: { type: Number, default: 0 }, // total Feed entries created
      followers: { type: Number, default: 0 }, // reason: "follow"
      audience: { type: Number, default: 0 }, // reason: "audience"
      domain: { type: Number, default: 0 }, // reason: "domain" (public)
      self: { type: Number, default: 0 }, // reason: "self"
      mentions: { type: Number, default: 0 }, // reason: "mention"
    },

    // Processing timestamps
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // Retry logic
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextAttemptAt: { type: Date, default: () => new Date(), index: true },
    lastError: { type: String, default: null },

    // Deduplication
    dedupeHash: { type: String, unique: true, sparse: true }, // prevent duplicate jobs

    // TTL for cleanup
    ttl: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 3600 * 1000),
    }, // 7 days
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for worker queries
FeedFanOutSchema.index({ status: 1, nextAttemptAt: 1 }); // worker poll
FeedFanOutSchema.index({ ttl: 1 }, { expireAfterSeconds: 0 }); // TTL cleanup
FeedFanOutSchema.index({ feedCacheId: 1, status: 1 }); // lookup by source

// Virtual for id (maps _id to id for consistency)
FeedFanOutSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

export default mongoose.model("FeedFanOut", FeedFanOutSchema);
