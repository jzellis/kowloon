import mongoose from "mongoose";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
import { Settings } from "./index.js";

const ReactSchema = new Schema(
  {
    id: { type: String, key: true },
    target: { type: String, required: true },
    actorId: { type: String, required: true },
    emoji: { type: String, required: true },
    name: { type: String, required: true },
    to: { type: [String], default: ["@public"] }, // If the post is public, this is set to "@public"; if it's server-only, it's set to "@server"; if it's a DM it's set to the recipient(s)
    cc: { type: [String], default: [] }, // This is for posts to publicGroups or tagging people in
    bcc: { type: [String], default: [] }, // This is for posts to private Groups
    rto: { type: [String], default: ["@server"] },
    rcc: { type: [String], default: [] },
    rbcc: { type: [String], default: [] },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ReactSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

ReactSchema.pre("save", async function (next) {
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `like:${this._id}@${domain}`;
  next();
});
export default mongoose.model("React", ReactSchema);
