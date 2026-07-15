import mongoose from "mongoose";
import { React, Reply } from "./index.js";
const Schema = mongoose.Schema;
import Member from "./subschema/Member.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import { signAs, verifyAs } from "#methods/utils/signing.js";

const CircleSchema = new Schema(
  {
    id: { type: String, key: true },
    // Local domain on create; the source domain when hydrated from a remote server.
    originDomain: { type: String, default: () => getServerSettings()?.domain },
    type: { type: String, enum: ["Circle", "System"], default: "Circle" },
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
  reactPreview: { type: String, default: null }, // Most-used emoji react
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    url: { type: String, default: undefined },
    lastFetchedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },   // high-water mark: most recent post the owner has seen
    signature: { type: Buffer, default: undefined },
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

    this.icon = this.icon || `https://${domain}/images/circle.svg`;
    this.server = this.server || actorId;
  }
  this.reactCount = (await React.find({ target: this.id }).lean()).length;
  this.replyCount = (await Reply.find({ target: this.id }).lean()).length;

  try {
    const memberList = (this.members || []).map(m => m.id).sort().join(",");
    const sig = await signAs(this.actorId, `${this.id}|${this.name || ""}|${this.to}|${memberList}`);
    if (sig) this.signature = sig;
  } catch (e) {
    // non-fatal — circle saves without signature if actor unavailable
  }

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

CircleSchema.methods.verifySignature = async function () {
  const memberList = (this.members || []).map(m => m.id).sort().join(",");
  return verifyAs(this.actorId, `${this.id}|${this.name || ""}|${this.to}|${memberList}`, this.signature);
};

export default mongoose.model("Circle", CircleSchema);
