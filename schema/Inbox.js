// /schema/Inbox.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const StatusSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["accepted", "processed", "rejected", "quarantined", "error"],
      required: true,
      default: "accepted",
    },
    reason: { type: String, default: null }, // e.g., "invalid_signature", "create_failed"
  },
  { _id: false }
);

const InboxSchema = new Schema(
  {
    // Routing & dedupe
    remoteId: { type: String, index: true, sparse: true }, // sender's Activity id
    domain: { type: String, index: true }, // resolved from Host / signature
    actorId: { type: String, index: true }, // "@alice@remote.tld"
    type: { type: String, index: true }, // "Create" | "Follow" | ...
    receivedAt: { type: Date, default: Date.now, index: true },

    // Verification metadata
    verified: { type: Boolean, default: false },
    keyId: { type: String },
    sigHeaders: { type: Object }, // minimal subset (date, digest, host)
    http: {
      ip: { type: String },
      userAgent: { type: String },
    },

    // Raw envelope
    body: { type: Object, required: true },
    headers: { type: Object }, // sanitized/whitelisted

    // Processing lifecycle
    status: { type: StatusSchema, default: () => ({ type: "accepted" }) },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: null },
    processedAt: { type: Date, default: null },
    activityId: { type: String, default: null }, // id of Activity created (if any)

    // Retention
    ttl: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 3600 * 1000),
    }, // 30d
  },
  { timestamps: true }
);

// Idempotency on remoteId (only when present)
InboxSchema.index({ remoteId: 1 }, { unique: true, sparse: true });
// Ops-friendly views
InboxSchema.index({ domain: 1, receivedAt: -1 });
InboxSchema.index({ "status.type": 1, receivedAt: -1 });
// Auto-expire old envelopes
InboxSchema.index({ ttl: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Inbox", InboxSchema);
