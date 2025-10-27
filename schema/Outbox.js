import mongoose from "mongoose";
import { Settings } from "./index.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
const Schema = mongoose.Schema;

const OutboxSchema = new Schema(
  {
    id: String,
    status: {
      type: String,
      enum: ["pending", "delivered", "error"],
      default: "pending",
    },
    activity: { type: Object, required: true },
    response: { type: Object, default: null },
    lastAttemptedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    error: { type: Object, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "outbox",
  }
);

OutboxSchema.pre("save", async function (next) {
  // Create the activity id and url
  const { domain } = getServerSettings();
  this.id = this.id || `outbox:${this._id}@${domain}`;
  next();
});

export default mongoose.model("Outbox", OutboxSchema);
