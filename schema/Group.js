// /schema/Group.js
import mongoose from "mongoose";
import Settings from "./Settings.js";
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
    icon: { type: String, default: undefined },
    location: { type: GeoPoint, default: undefined },

    // Membership policy
    rsvpPolicy: {
      type: String,
      enum: ["invite_only", "open", "approval"],
      default: "invite_only",
    },

    // Addressing defaults
    to: { type: String, default: "" },
    canReply: { type: String, default: "" },
    canReact: { type: String, default: "" },

    // Circle references (ownerId of each circle is this group's id)
    admins: { type: String, default: "" }, // circle id
    moderators: { type: String, default: "" }, // circle id
    members: { type: String, default: "" }, // circle id
    invited: { type: String, default: "" }, // circle id
    blocked: { type: String, default: "" }, // circle id
    requests: { type: String, default: "" }, // circle id for approval requests (NEW)

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

// -------- pre('save'): mint id/url/server/icon (no member/admin pushes here) --------
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

    // Safe memberCount update (only on updates and not during the moment we first set members)
    if (!this.isNew && this.members && !this.isModified("members")) {
      const c = await Circle.findOne({ id: this.members })
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

// -------- post('save'): ensure circles + seed creator into admins/moderators/members --------
GroupSchema.post("save", async function (doc) {
  try {
    // Only create circles for local groups
    const domainSetting = await Settings.findOne({ name: "domain" });
    const domain = domainSetting?.value;
    if (!domain || !doc?.id || !String(doc.id).endsWith(`@${domain}`)) {
      return; // remote mirror or missing config -- do nothing
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
        canReply: doc.id,
        canReact: doc.id,
      });
      doc[key] = created.id; // key ∈ {admins, moderators, members, invited, blocked, requests}
      // Persist without re-entering pre('save') hooks (avoid racing memberCount calc)
      await doc.constructor.updateOne(
        { _id: doc._id },
        { $set: { [key]: created.id } }
      );
      return created;
    }

    // Ensure all six circles exist (added: Requests)
    const adminsCircle = await ensureCircle(doc.admins, "admins", "Admins");
    const moderatorsCircle = await ensureCircle(
      doc.moderators,
      "moderators",
      "Moderators"
    );
    const membersCircle = await ensureCircle(doc.members, "members", "Members");
    const invitedCircle = await ensureCircle(doc.invited, "invited", "Invited");
    const blockedCircle = await ensureCircle(doc.blocked, "blocked", "Blocked");
    const requestsCircle = await ensureCircle(
      doc.requests,
      "requests",
      "Requests"
    );

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

    // Finalize memberCount now that the creator has been seeded
    if (membersCircle?.id) {
      const c = await Circle.findOne({ id: membersCircle.id })
        .select("members")
        .lean();
      const count = Array.isArray(c?.members) ? c.members.length : 0;
      await doc.constructor.updateOne(
        { _id: doc._id },
        { $set: { memberCount: count } }
      );
    }

    // (No default seeds for invited/blocked/requests)
  } catch (err) {
    console.error("Group post-save circle ensure error:", err);
  }
});

export default mongoose.model("Group", GroupSchema);
