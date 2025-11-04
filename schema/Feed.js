// /schema/Feed.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Feed = per-viewer fan-out rows
 * - NO 'to' here: presence of the row implies view permission.
 * - Store per-viewer action capabilities, which may differ per actor.
 */
const FeedSchema = new Schema(
  {
    // Viewer & target
    actorId: { type: String, required: true, index: true }, // local viewer
    objectId: { type: String, required: true, index: true }, // FeedCache.id (global)

    // Author for quick render/filter
    activityActorId: { type: String, required: true, index: true }, // object author

    // Why it's in this feed (coarse, non-leaky)
    reason: {
      type: String,
      enum: ["domain", "follow", "audience", "mention", "self"],
      index: true,
    },

    // Render + sort
    createdAt: { type: Date, required: true }, // usually FeedCache.publishedAt
    fetchedAt: { type: Date, default: () => new Date() },

    // Tiny snapshot for list UIs (keep minimal)
    snapshot: {
      type: Object, // e.g., { title, excerpt, media: [thumbUrls], visibilityLabel }
      default: undefined,
    },

    // Per-viewer action capabilities (computed at ingest)
    canReply: { type: Boolean, default: false },
    canReact: { type: Boolean, default: false },

    // UX flags
    seenAt: { type: Date, default: null },
    hidden: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    rank: { type: Number, default: 0 },
  },
  {
    strict: false,
    timestamps: true, // also keeps updatedAt for edits (pin/hide)
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// De-dup per viewer/object; fast timeline sorts
FeedSchema.index({ actorId: 1, objectId: 1 }, { unique: true });
FeedSchema.index({ actorId: 1, createdAt: -1, _id: -1 });
FeedSchema.index({ actorId: 1, reason: 1, createdAt: -1 });

export default mongoose.model("Feed", FeedSchema);
