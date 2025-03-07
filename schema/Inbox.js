import mongoose from "mongoose";
import { Settings } from "./index.js";
const Schema = mongoose.Schema;

const InboxSchema = new Schema(
  {
    id: { type: [String] },
    to: { type: [String], required: true },
    item: { type: Object, required: true },
    read: { type: Boolean, default: false },
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
