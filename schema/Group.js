import mongoose from "mongoose";
import { Settings, User } from "./index.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const GroupSchema = new Schema(
  {
    id: { type: String, key: true },
    objectType: { type: String, default: "Group" },
    name: { type: String, default: undefined },
    actorId: { type: String, required: true }, // Who created this group?
    summary: { type: String, default: undefined },
    icon: { type: String, default: undefined },
    location: { type: Object, default: undefined },
    members: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, default: undefined },
          inbox: { type: String, default: undefined },
          outbox: { type: String, default: undefined },
          icon: { type: String, default: undefined },
          url: { type: String, default: undefined },
          serverId: { type: String },
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    pending: { type: [String], default: [] }, // Pending members
    banned: { type: [String], default: [] }, // Banned users who cannot join
    admins: { type: [String], default: [] },
    to: { type: [String], default: [] }, // Who can see this group
    replyTo: { type: [String], default: [] }, // Who can reply to this group (unused but here for consistency)
    reactTo: { type: [String], default: [] }, // Who can react to this group
    replyCount: { type: Number, default: 0 }, // The number of replies to this post (unused but here for consistency)
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    private: { type: Boolean, default: false }, // If members must be approved to join
    flaggedAt: { type: Date, default: null },
    flaggedBy: { type: String, default: null },
    flaggedReason: { type: String, default: null },

    deletedAt: { type: Date, default: null }, // If the group is deleted, when it was deleted
    deletedBy: { type: String, default: null }, // If the group is deleted, who deleted it (usually the user unless an admin does it),
    url: { type: String, default: undefined },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

GroupSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

GroupSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

GroupSchema.pre("save", async function (next) {
  if (this.isNew) {
    let actor = await User.findOne({ id: this.actorId });
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.title = this.title && this.title.trim();
    this.id = this.id || `group:${this._id}@${domain}`;
    this.url = this.url || `https://${domain}/groups/${this.id}`;
    this.icon = this.icon || `https://${domain}/images/group.png`;
    if (this.members.length === 0) {
      this.members.push({
        id: actor.id,
        name: actor.profile.name,
        icon: actor.profile.icon,
        inbox: `https://${domain}/users/${actor.id}/inbox`,
        outbox: `https://${domain}/users/${actor.id}/outbox`,
        serverId: `@${domain}`,
        url: actor.url,
        updatedAt: Date.now(),
      });
    }
    if (this.admins.length === 0) {
      this.admins.push(actor.id);
    }
  }
  next();
});

export default mongoose.model("Group", GroupSchema);
