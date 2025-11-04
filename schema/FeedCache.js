// /schema/FeedCache.js
import mongoose from "mongoose";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

const { Schema } = mongoose;

// Audience + capability enums (no Circle/ID leakage)
export const TO_ENUM = ["public", "server", "audience"]; // who can see in principle
export const CAP_ENUM = ["public", "followers", "audience", "none"]; // who may act in principle

const FeedCacheSchema = new Schema(
  {
    // Canonical identifiers
    id: { type: String, key: true }, // global canonical id (remote as-is; local minted)
    url: { type: String, default: undefined }, // canonical URL (locals minted below)
    server: { type: String, default: undefined }, // local server actor id (from settings)

    // Provenance
    origin: { type: String, enum: ["local", "remote"], required: true },
    originDomain: { type: String, default: undefined }, // e.g. "serverb.org"

    // Author
    actorId: { type: String, required: true }, // author @user@domain

    // Object typing (matches your pattern)
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
    // Subtype (e.g., Post → Note/Article/Media/Link; Bookmark → Folder/Bookmark)
    type: { type: String, default: undefined },

    // Threading (optional)
    inReplyTo: { type: String, default: undefined },
    threadRoot: { type: String, default: undefined },

    // Normalized content envelope for detail views
    object: { type: Object, default: undefined },

    // Audience & capabilities (NO Circle IDs, just coarse policy)
    to: { type: String, enum: TO_ENUM, default: "public", index: true },
    canReply: { type: String, enum: CAP_ENUM, default: "public" },
    canReact: { type: String, enum: CAP_ENUM, default: "public" },

    // Sort/freshness
    publishedAt: { type: Date, required: true },
    updatedAt: { type: Date, default: undefined },

    // Federation freshness
    etag: { type: String, default: undefined },
    lastSyncedAt: { type: Date, default: undefined },

    // Deletion/tombstone
    deletedAt: { type: Date, default: null },
    tombstoned: { type: Boolean, default: false },
  },
  {
    strict: false, // allow handler-specific extras (mirrors Activity pattern)
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Mint id/url/server for LOCAL-origin records; keep remote ids/urls as-is
FeedCacheSchema.pre("save", async function (next) {
  try {
    const { domain, actorId } = getServerSettings();

    if (this.origin === "local" && domain) {
      if (!this.id) {
        const ns = (this.objectType || "object").toLowerCase();
        this.id = `${ns}:${this._id}@${domain}`;
      }
      if (!this.url) {
        const ns = (this.objectType || "objects").toLowerCase();
        this.url = `https://${domain}/${ns}/${this.id}`;
      }
      if (!this.server && actorId) {
        this.server = actorId;
      }
    }

    if (!this.publishedAt) this.publishedAt = this.createdAt || new Date();
    next();
  } catch (err) {
    next(err);
  }
});

// Indexes
FeedCacheSchema.index({ id: 1 }, { unique: true }); // de-dupe
FeedCacheSchema.index({ actorId: 1, publishedAt: -1, _id: -1 }); // author timeline
FeedCacheSchema.index({ originDomain: 1, publishedAt: -1 }); // ops/domain scans
FeedCacheSchema.index({ objectType: 1, publishedAt: -1 }); // type-filtered
FeedCacheSchema.index({ to: 1, publishedAt: -1 }); // public/server/audience scans

export default mongoose.model("FeedCache", FeedCacheSchema);
