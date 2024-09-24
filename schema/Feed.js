import mongoose from "mongoose";
import { Settings } from "./index.js";
const Schema = mongoose.Schema;

const FeedSchema = new Schema(
  {
    id: { type: String },
    to: { type: [String] },
    cc: { type: [String] },
    bcc: { type: [String] },
    item: { type: Object, required: true },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

FeedSchema.pre("save", async function (next) {
  // Create the activity id and url
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `feed:${this._id}@${domain}`;
  next();
});

export default mongoose.model("Feed", FeedSchema);
