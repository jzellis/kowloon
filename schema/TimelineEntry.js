// /schema/TimelineEntry.js
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
    objectId: { type: String, required: true }, // e.g. "post:uuid@remote.tld"
    createdAt: { type: Date, required: true, index: true }, // source object's timestamp

    // why this is in the feed
    reason: {
      type: String,
      enum: ["follow", "domain", "mention", "self", "circle", "group", "event"], // added group/event
      required: true,
    },

    // visibility at fetch time
    scope: {
      type: String,
      enum: ["public", "server", "circle"],
      required: true,
    },

    // local scoping (never expose)
    localCircleId: { type: String, default: undefined, select: false },
    localGroupId: { type: String, default: undefined, select: false }, // optional
    localEventId: { type: String, default: undefined, select: false }, // optional

    // denormalized render bits (keep small)
    snapshot: {
      id: String,
      actorId: String,
      title: String,
      body: String,
      media: [Object],
      visibility: { type: String, enum: ["public", "server", "circle"] },
      summary: String,
    },

    originDomain: { type: String },
    fetchedAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TimelineEntrySchema.index({ userId: 1, objectId: 1 }, { unique: true });
TimelineEntrySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("TimelineEntry", TimelineEntrySchema);
