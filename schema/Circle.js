import mongoose from "mongoose";
import Settings from "./Settings.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const CircleSchema = new Schema(
  {
    id: { type: String, key: true },
    name: { type: String, default: undefined },
    actorId: { type: String, required: true },
    summary: { type: String, default: undefined },
    icon: { type: String, default: undefined },
    members: { type: [String], default: [] },
    to: { type: [String], default: [] }, // If the post is public, this is set to "@public"; if it's server-only, it's set to "@server"; if it's a DM it's set to the recipient(s)
    cc: { type: [String], default: [] }, // This is for posts to publicGroups or tagging people in
    bcc: { type: [String], default: [] }, // This is for posts to private Groups
    rto: { type: [String], default: ["@server"] },
    rcc: { type: [String], default: [] },
    rbcc: { type: [String], default: [] },
    deletedAt: { type: Date, default: null },
    url: { type: String, default: undefined },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CircleSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

CircleSchema.pre("save", async function (next) {
  if (this.isNew) {
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.title = this.title && this.title.trim();
    this.id = this.id || `circle:${this._id}@${domain}`;
    this.url = this.url || `//${domain}/circles/${this.id}`;

    this.icon = this.icon || `https://${domain}/images/circle.png`;
  }
  next();
});

export default mongoose.model("Circle", CircleSchema);
