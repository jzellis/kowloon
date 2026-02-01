// /schema/Group.js
import mongoose from "mongoose";
import { Circle, User, React, Reply } from "./index.js";
import GeoPoint from "./subschema/GeoPoint.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

const { Schema } = mongoose;

const GroupSchema = new Schema(
  {
    id: { type: String, key: true, index: true },
    objectType: { type: String, default: "Group" },

    // Ownership / actor
    actorId: { type: String, required: true }, // creator's @user@domain (local for local groups)
    actor: { type: Object, default: undefined },
    server: { type: String, default: undefined }, // server of the actor/creator

    // Presentation
    name: { type: String, default: undefined },
    description: { type: String, default: undefined },
    icon: { type: String, default: undefined }, // File ID or URL for backwards compatibility
    location: { type: GeoPoint, default: undefined },

    // Membership policy
    rsvpPolicy: {
      type: String,
      enum: ["open", "approval"],
      default: "open",
    },

    // Addressing defaults
    to: { type: String, default: "" },
    canReply: { type: String, default: "" },
    canReact: { type: String, default: "" },

    // Circle references (ownerId of each circle is this group's id)
    circles: {
      admins: { type: String, default: "" }, // circle id
      moderators: { type: String, default: "" }, // circle id
      members: { type: String, default: "" }, // circle id
      blocked: { type: String, default: "" }, // circle id
      pending: { type: String, default: "" }, // circle id for approval pending
    },

    memberCount: { type: Number, default: 1 },

    // Denormalized counts (optional)
    replyCount: { type: Number, default: 0 },
    reactCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },

    // Soft delete
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },

    // Links
    url: { type: String, default: undefined },
    inbox: { type: String, alias: "inboxUrl" },
    outbox: { type: String, alias: "outboxUrl" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    strict: false,
  }
);

// Virtuals
GroupSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

// -------- pre('save'): mint id/url/server/icon AND create circles synchronously --------
GroupSchema.pre("save", async function (next) {
  try {
    const { domain, actorId } = getServerSettings();

    if (this.name) this.name = this.name.trim();

    if (!this.id && domain) this.id = `group:${this._id}@${domain}`;
    if (!this.url && domain && this.id)
      this.url = `https://${domain}/groups/${this.id}`;
    if (!this.icon && domain) this.icon = `https://${domain}/images/group.png`;
    if (!this.server && actorId) this.server = actorId;

    if (!this.inbox) this.inbox = `https://${domain}/groups/${this.id}/inbox`;
    if (!this.outbox)
      this.outbox = `https://${domain}/groups/${this.id}/outbox`;

    // Only create circles for NEW local groups
    const isLocal = domain && this.id && String(this.id).endsWith(`@${domain}`);

    if (this.isNew && isLocal) {
      // Helper: create a circle and return its ID
      const createCircle = async (label) => {
        const created = await Circle.create({
          name: `${this.name || "Group"} - ${label}`,
          actorId: this.id, // owner is this group
          description: `${this.name || "Group"} | ${label}`,
          to: this.id,
          canReply: this.id,
          canReact: this.id,
        });
        return created.id;
      };

      // Create all circles
      if (!this.circles) this.circles = {};
      if (!this.circles.admins) this.circles.admins = await createCircle("Admins");
      if (!this.circles.moderators) this.circles.moderators = await createCircle("Moderators");
      if (!this.circles.members) this.circles.members = await createCircle("Members");
      if (!this.circles.blocked) this.circles.blocked = await createCircle("Blocked");
      if (!this.circles.pending) this.circles.pending = await createCircle("Pending");

      // Seed creator into admins + moderators + members
      if (this.actorId) {
        const creator = await User.findOne({ id: this.actorId }).lean();
        const member = creator
          ? {
              id: creator.id,
              name: creator?.profile?.name,
              icon: creator?.profile?.icon,
              url: creator?.url,
              inbox: creator?.inbox,
              outbox: creator?.outbox,
              server: creator?.server,
            }
          : { id: this.actorId };

        const now = new Date();
        await Promise.all([
          Circle.findOneAndUpdate(
            { id: this.circles.admins, "members.id": { $ne: member.id } },
            { $push: { members: member }, $set: { updatedAt: now } },
            { new: true }
          ),
          Circle.findOneAndUpdate(
            { id: this.circles.moderators, "members.id": { $ne: member.id } },
            { $push: { members: member }, $set: { updatedAt: now } },
            { new: true }
          ),
          Circle.findOneAndUpdate(
            { id: this.circles.members, "members.id": { $ne: member.id } },
            { $push: { members: member }, $set: { updatedAt: now } },
            { new: true }
          ),
        ]);

        // Set initial memberCount
        this.memberCount = 1;
      }
    } else if (!this.isNew && this.circles?.members && !this.isModified("circles.members")) {
      // Safe memberCount update for existing groups
      const c = await Circle.findOne({ id: this.circles.members })
        .select("members")
        .lean();
      this.memberCount = Array.isArray(c?.members)
        ? c.members.length
        : this.memberCount ?? 0;
    }

    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model("Group", GroupSchema);
