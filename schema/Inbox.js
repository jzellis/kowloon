import mongoose from "mongoose";
import { Settings } from "./index.js";
const Schema = mongoose.Schema;

const InboxSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "completed", "blocked", "error"],
      default: "pending",
    },
    activity: { type: Object, required: true },
    server: { type: String, required: true },
    ipAddress: { type: String, required: true },
    processedAt: { type: Date, default: null },
    error: { type: Object, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "inbox",
  }
);

InboxSchema.pre("save", async function (next) {
  // Create the activity id and url
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `inbox:${this._id}@${domain}`;
  next();
});

export default mongoose.model("Inbox", InboxSchema);
