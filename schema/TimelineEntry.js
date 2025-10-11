// schema/TimelineEntry.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const TimelineEntrySchema = new Schema(
  {
    userId: { type: String, index: true, required: true }, // "@me@mydomain"
    objectType: {
      type: String,
      enum: [
        "Post",
        "Reply",
        "Event",
        "Page",
        "Bookmark",
        "File",
        "Group",
        "Circle",
        "Invite",
        "Flag",
        "React",
      ],
      required: true,
      index: true,
    },
    objectId: { type: String, required: true }, // e.g., "post:uuid@remote.tld"
    createdAt: { type: Date, required: true, index: true }, // from the object, for sorting

    // why this is in the feed
    reason: {
      type: String,
      enum: ["follow", "domain", "mention", "self", "circle"],
      required: true,
    },

    // what the viewer was allowed to see at fetch time (never reveal circle name/id)
    scope: {
      type: String,
      enum: ["public", "server", "circle"],
      required: true,
    },

    // optional local-only discriminator for filtering timelines by your own circles
    // never expose this in APIs
    localCircleId: { type: String, default: undefined, select: false },

    // denormalized fields to render quickly (keep small; omit secrets)
    snapshot: {
      id: String,
      actorId: String,
      title: String,
      body: String,
      media: [Object],
      visibility: { type: String, enum: ["public", "server", "circle"] },
      summary: String,
      // add anything cheap you routinely display
    },

    // housekeeping
    originDomain: { type: String }, // author's domain
    fetchedAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null }, // hide without losing audit trail
  },
  { timestamps: true } // adds createdAt/updatedAt (different from object createdAt)
);

// Avoid duplicates per viewer/object
TimelineEntrySchema.index({ userId: 1, objectId: 1 }, { unique: true });

// Fast list queries
TimelineEntrySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("TimelineEntry", TimelineEntrySchema);
