// /schema/Event.js
import mongoose from "mongoose";
import Settings from "./Settings.js";
import { Circle, User, React, Reply } from "./index.js";
import GeoPoint from "./subschema/GeoPoint.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

const { Schema } = mongoose;

// ---- Event Schema: circle references instead of embedded arrays ----
const EventSchema = new Schema(
  {
    id: { type: String, key: true, index: true }, // global stable id e.g. event:<_id>@<domain>
    type: { type: String, default: "Event" },
    actor: { type: Object, default: undefined },
    actorId: { type: String, required: true }, // creator's @user@domain (local for local events)
    server: { type: String, default: undefined }, // server of the event author

    // Addressing / vis
    to: { type: String, default: "" },
    canReply: { type: String, default: "" },
    canReact: { type: String, default: "" },

    // Content
    title: { type: String, default: undefined },
    description: { type: String, default: undefined },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    timezone: String,
    location: { type: GeoPoint, default: undefined },
    ageRestricted: { type: Boolean, default: false },
    href: { type: String, default: undefined },
    url: { type: String, default: undefined },
    rsvpPolicy: {
      type: String,
      enum: ["invite_only", "open", "approval"],
      default: "invite_only",
    },
    capacity: { type: Number, default: 0 }, // 0 = unlimited

    // Circle references (IDs; each circle's ownerId will be this event's id)
    admins: { type: String, default: "" }, // circle id
    invited: { type: String, default: "" }, // circle id
    moderators: { type: String, default: "" }, // circle id
    interested: { type: String, default: "" }, // circle id
    attending: { type: String, default: "" }, // circle id
    blocked: { type: String, default: "" }, // circle id  <-- NEW
    adminCount: { type: Number, default: 1 },
    invitedCount: { type: Number, default: 0 },
    interestedCount: { type: Number, default: 0 },
    attendingCount: { type: Number, default: 1 },
    blockedCount: { type: Number, default: 0 },

    // Denormalized counts (optional; keep for UI speed)
    replyCount: { type: Number, default: 0 },
    reactCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    inbox: { type: String, alias: "inboxUrl" },
    outbox: { type: String, alias: "outboxUrl" },

    // Soft delete
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  {
    strict: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---------- pre('save'): mint id/url/server like your current style ----------
EventSchema.pre("save", async function (next) {
  try {
    const { domain, actorId } = getServerSettings();

    if (!this.inbox) this.inbox = `https://${domain}/events/${this.id}/inbox`;
    if (!this.outbox)
      this.outbox = `https://${domain}/events/${this.id}/outbox`;

    // normalize title/name
    if (this.title) this.title = this.title.trim();
    if (!this.title && this.name) this.title = String(this.name).trim();

    // ids/urls
    if (!this.id && domain) this.id = `event:${this._id}@${domain}`;
    if (!this.url && domain && this.id) {
      this.url = `https://${domain}/events/${this.id}`;
    }
    if (!this.server && actorId) this.server = actorId;

    // Safe attendingCount update (only on updates and not during the moment we first set attending)
    if (!this.isNew && this.attending && !this.isModified("attending")) {
      const c = await Circle.findOne({ id: this.attending })
        .select("members")
        .lean();
      this.attendingCount = Array.isArray(c?.members)
        ? c.members.length
        : this.attendingCount ?? 0;
    }

    this.reactCount = await React.find({ target: this.id }).countDocuments();
    this.replyCount = await Reply.find({ target: this.id }).countDocuments();

    next();
  } catch (err) {
    next(err);
  }
});

// ---------- post('save'): ensure circles + seed creator into admins ----------
EventSchema.post("save", async function (doc) {
  try {
    // Only handle local events (doc.id must include our domain)
    const domainSetting = await Settings.findOne({ name: "domain" });
    const domain = domainSetting?.value;
    if (!domain || !doc?.id || !String(doc.id).endsWith(`@${domain}`)) {
      return; // remote event mirror or missing config → don't create local circles
    }

    // Helper to ensure (create if missing) a circle owned by this event
    async function ensureCircle(currentId, suffix, description) {
      if (currentId) {
        const c = await Circle.findOne({ id: currentId });
        if (c) return c; // already exists
      }
      // Create a new circle; let Circle's own hooks mint id
      const created = await Circle.create({
        name: `${doc.title || "Event"} - ${suffix}`,
        actorId: doc.id, // owner is the event itself
        description: description || `${doc.title || "Event"} | ${suffix}`,
        to: doc.id, // default addressing: to the event
        canReply: doc.id,
        canReact: doc.id,
      });
      // Store back the circle id on the event document field that references it
      const field = suffix.toLowerCase(); // admins|invited|interested|attending|blocked
      doc[field] = created.id;
      // Persist without re-entering pre('save') hooks (avoid racing the attendingCount calc)
      await doc.constructor.updateOne(
        { _id: doc._id },
        { $set: { [field]: created.id } }
      );
      return created;
    }

    // Ensure all five circles exist
    const adminsCircle = await ensureCircle(doc.admins, "Admins", "Admins");
    const invitedCircle = await ensureCircle(doc.invited, "Invited", "Invited");
    const modCircle = await ensureCircle(
      doc.invited,
      "Moderators",
      "Moderators"
    );
    const interestedCircle = await ensureCircle(
      doc.interested,
      "Interested",
      "Interested"
    );
    const attendingCircle = await ensureCircle(
      doc.attending,
      "Attending",
      "Attending"
    );
    const blockedCircle = await ensureCircle(doc.blocked, "Blocked", "Blocked"); // NEW

    // Seed creator (actorId) into Admins circle, once
    if (doc.actorId) {
      // Enrich from local user if available
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

      // Only push if not already present
      await Circle.findOneAndUpdate(
        { id: adminsCircle.id, "members.id": { $ne: member.id } },
        { $push: { members: member }, $set: { updatedAt: new Date() } },
        { new: true }
      );

      await Circle.findOneAndUpdate(
        { id: attendingCircle.id, "members.id": { $ne: member.id } },
        { $push: { members: member }, $set: { updatedAt: new Date() } },
        { new: true }
      );

      // Finalize attendingCount now that the creator has been seeded
      if (attendingCircle?.id) {
        const c = await Circle.findOne({ id: attendingCircle.id })
          .select("members")
          .lean();
        const count = Array.isArray(c?.members) ? c.members.length : 0;
        await doc.constructor.updateOne(
          { _id: doc._id },
          { $set: { attendingCount: count } }
        );
      }
    }

    // No default seeds for invited/interested/attending/blocked
  } catch (err) {
    // Post hooks don't take next(); log so we can debug without breaking saves
    console.error("Event post-save circle ensure error:", err);
  }
});

export default mongoose.model("Event", EventSchema);

let activity = {
  activity: {
    actorId: "@you@server.com",
    type: "Create",
    objectType: "Post",
    object: {
      actorId: "@you@server.com",
      type: "Article",
      title: "Hello, world!",
      content: "This is my first post!",
      to: "@public",
      canReply: "@server.com",
      canReact: "@public",
    },
    to: "@public",
    canReply: "@server.com",
    canReact: "@public",
  },
};
