// /schema/Group.js
import mongoose from "mongoose";
import Settings from "./Settings.js";
import { Circle, User } from "./index.js";

const { Schema } = mongoose;

const GroupSchema = new Schema(
  {
    id: { type: String, key: true },
    objectType: { type: String, default: "Group" },

    // Ownership / actor
    actorId: { type: String, required: true }, // creator's @user@domain (local for local groups)
    actor: { type: Object, default: undefined },
    server: { type: String, default: undefined }, // server of the actor/creator

    // Presentation
    name: { type: String, default: undefined },
    description: { type: String, default: undefined },
    icon: { type: String, default: undefined },
    location: { type: Object, default: undefined },

    // Addressing defaults
    to: { type: String, default: "" },
    replyTo: { type: String, default: "" },
    reactTo: { type: String, default: "" },

    // Circle references (store the Circle IDs — ownerId of each is this group's id)
    admins: { type: String, default: "" }, // circle id
    moderators: { type: String, default: "" }, // circle id
    members: { type: String, default: "" }, // circle id
    invited: { type: String, default: "" }, // circle id
    blocked: { type: String, default: "" }, // circle id

    // Denormalized counts (optional)
    replyCount: { type: Number, default: 0 },
    reactCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },

    // Soft delete
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },

    // Links
    url: { type: String, default: undefined },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    strict: false,
  }
);

// Keep your reacts virtual
GroupSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

// -------- pre('save'): mint id/url/server/icon (no member/admin pushes here) --------
GroupSchema.pre("save", async function (next) {
  try {
    const domainSetting = await Settings.findOne({ name: "domain" });
    const actorIdSetting = await Settings.findOne({ name: "actorId" });
    const domain = domainSetting?.value;
    const serverActorId = actorIdSetting?.value;

    if (this.name) this.name = this.name.trim();

    if (!this.id && domain) this.id = `group:${this._id}@${domain}`;
    if (!this.url && domain && this.id)
      this.url = `https://${domain}/groups/${this.id}`;
    if (!this.icon && domain) this.icon = `https://${domain}/images/group.png`;
    if (!this.server && serverActorId) this.server = serverActorId;

    next();
  } catch (err) {
    next(err);
  }
});

// -------- post('save'): ensure circles + seed creator into admins/moderators/members --------
GroupSchema.post("save", async function (doc) {
  try {
    // Only create circles for local groups
    const domainSetting = await Settings.findOne({ name: "domain" });
    const domain = domainSetting?.value;
    if (!domain || !doc?.id || !String(doc.id).endsWith(`@${domain}`)) {
      return; // remote mirror or missing config — do nothing
    }

    // Helper: ensure a circle exists and is linked to the group field
    async function ensureCircle(currentId, key, label) {
      if (currentId) {
        const existing = await Circle.findOne({ id: currentId });
        if (existing) return existing;
      }
      const created = await Circle.create({
        name: `${doc.name || "Group"} - ${label}`,
        actorId: doc.id, // owner is this group
        description: `${doc.name || "Group"} | ${label}`,
        to: doc.id,
        replyTo: doc.id,
        reactTo: doc.id,
      });
      doc[key] = created.id; // key ∈ {admins, moderators, members, invited, blocked}
      await doc.save(); // persist the circle id back to the Group
      return created;
    }

    // Ensure all five circles exist
    const adminsCircle = await ensureCircle(doc.admins, "admins", "Admins");
    const moderatorsCircle = await ensureCircle(
      doc.moderators,
      "moderators",
      "Moderators"
    );
    const membersCircle = await ensureCircle(doc.members, "members", "Members");
    const invitedCircle = await ensureCircle(doc.invited, "invited", "Invited");
    const blockedCircle = await ensureCircle(doc.blocked, "blocked", "Blocked");

    // Seed creator into admins + moderators + members once
    if (doc.actorId) {
      const creator = await User.findOne({ id: doc.actorId }).lean();
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
        : { id: doc.actorId };

      // add only if not already present
      const now = new Date();
      await Promise.all([
        Circle.findOneAndUpdate(
          { id: adminsCircle.id, "members.id": { $ne: member.id } },
          { $push: { members: member }, $set: { updatedAt: now } },
          { new: true }
        ),
        Circle.findOneAndUpdate(
          { id: moderatorsCircle.id, "members.id": { $ne: member.id } },
          { $push: { members: member }, $set: { updatedAt: now } },
          { new: true }
        ),
        Circle.findOneAndUpdate(
          { id: membersCircle.id, "members.id": { $ne: member.id } },
          { $push: { members: member }, $set: { updatedAt: now } },
          { new: true }
        ),
      ]);
    }

    // (No default seeds for invited/blocked)
  } catch (err) {
    console.error("Group post-save circle ensure error:", err);
  }
});

export default mongoose.model("Group", GroupSchema);
