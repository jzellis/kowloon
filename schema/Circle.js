import mongoose from "mongoose";
import { React, Reply } from "./index.js";
const Schema = mongoose.Schema;
import Member from "./subschema/Member.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

const CircleSchema = new Schema(
  {
    id: { type: String, key: true },
    type: { type: String, default: "Circle" },
    name: { type: String, default: undefined },
    actorId: { type: String, required: true },
    actor: { type: Object, default: undefined },
    server: { type: String, default: undefined },
    summary: { type: String, default: undefined },
    icon: { type: String, default: undefined }, // File ID or URL for backwards compatibility
    members: { type: [Member], default: [] },
    memberCount: { type: Number, default: 0 },
    to: { type: String, default: "" },
    canReply: { type: String, default: "" },
    canReact: { type: String, default: "" },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    url: { type: String, default: undefined },
    lastFetchedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
CircleSchema.index({ "members.id": 1 }); // fast "is viewer a member?" checks
CircleSchema.index({ "members.server": 1 });
CircleSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

CircleSchema.pre("save", async function (next) {
  if (this.isNew) {
    const { domain, actorId } = getServerSettings();
    this.title = this.title && this.title.trim();
    this.id = this.id || `circle:${this._id}@${domain}`;
    this.url = this.url || `https://${domain}/circles/${this.id}`;

    this.icon = this.icon || `https://${domain}/images/circle.png`;
    this.server = this.server || actorId;
  }
  this.reactCount = (await React.find({ target: this.id }).lean()).length;
  this.replyCount = (await Reply.find({ target: this.id }).lean()).length;
  next();
});

// Update Group's memberCount when a Group's members circle is modified
CircleSchema.post("updateOne", async function () {
  try {
    const query = this.getQuery();
    const circleId = query.id;
    if (!circleId) return;

    // Check if this circle belongs to a Group as its members circle
    // Import Group dynamically to avoid circular dependency
    const Group = mongoose.model("Group");
    const group = await Group.findOne({ members: circleId });
    if (!group) return;

    // Get the updated member count from the circle
    const Circle = mongoose.model("Circle");
    const circle = await Circle.findOne({ id: circleId }).select("members").lean();
    const count = Array.isArray(circle?.members) ? circle.members.length : 0;

    // Update the Group's memberCount
    await Group.updateOne({ id: group.id }, { $set: { memberCount: count } });
  } catch (err) {
    console.error("Circle post-updateOne hook error:", err.message);
  }
});

export default mongoose.model("Circle", CircleSchema);
