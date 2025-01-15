import mongoose from "mongoose";
import Settings from "./Settings.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const GroupSchema = new Schema(
  {
    id: { type: String, key: true },
    name: { type: String, default: undefined },
    actorId: { type: String, required: true }, // Who created this group?
    summary: { type: String, default: undefined },
    icon: { type: String, default: undefined },
    location: { type: Object, default: undefined },
    members: { type: [String], default: [] },
    pending: { type: [String], default: [] }, // Pending members
    banned: { type: [String], default: [] }, // Banned users who cannot join
    admins: { type: [String], default: [] },
    to: { type: [String], default: ["@public"] }, // If the post is public, this is set to "@public"; if it's server-only, it's set to "@server"; if it's a DM it's set to the recipient(s)
    cc: { type: [String], default: [] }, // This is for posts to publicGroups or tagging people in
    bcc: { type: [String], default: [] }, // This is for posts to private Groups
    requiresUserApproval: { type: Boolean, default: false }, // If members must be approved to join
    flaggedAt: { type: Date, default: null },
    flaggedBy: { type: String, default: null },
    flaggedReason: { type: String, default: null },
    deletedAt: { type: Date, default: null }, // If the group is deleted, when it was deleted
    deletedBy: { type: String, default: null }, // If the group is deleted, who deleted it (usually the user unless an admin does it)
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

GroupSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

GroupSchema.pre("save", async function (next) {
  if (this.isNew) {
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.title = this.title && this.title.trim();
    this.id = this.id || `group:${this._id}@${domain}`;
    this.url = this.url || `https://${domain}/groups/${this.id}`;
    this.icon = this.icon || `https://${domain}/images/group.png`;
  }
  next();
});

export default mongoose.model("Group", GroupSchema);
