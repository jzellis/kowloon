import mongoose from "mongoose";
import { Settings } from "./index.js";
const Schema = mongoose.Schema;

const OutboxSchema = new Schema(
  {
    id: String,
    status: {
      type: String,
      enum: ["pending", "delivered", "error"],
      default: "pending",
    },
    to: { type: [String], required: true },
    server: { type: String, required: true },
    actorId: { type: String, required: true },
    object: { type: String, required: true },
    response: { type: Object, default: null },
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
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `inbox:${this._id}@${domain}`;
  next();
});

export default mongoose.model("Outbox", OutboxSchema);
