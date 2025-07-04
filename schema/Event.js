import mongoose from "mongoose";
import Settings from "./Settings.js";
const Schema = mongoose.Schema;

const EventSchema = new Schema(
  {
    id: { type: String, key: true }, // This is different from the _id, this is the global UUID of the event.
    actor: { type: Object, default: undefined },
    actorId: { type: String, required: true }, // The actor ID of the event's author. Required.
    server: { type: String, default: undefined }, // The server of the event's author.
    type: { type: String, default: "Event" }, // We can create a list of possible event types later
    to: { type: String, default: "" },
    replyTo: { type: String, default: "" },
    reactTo: { type: String, default: "" },
    title: { type: String, default: undefined },
    description: { type: String, default: undefined },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    location: { type: Object, default: undefined },
    ageRestricted: { type: Boolean, default: false },
    href: { type: String, default: undefined },
    admins: { type: [String], default: [] },
    attending: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, default: undefined },
          inbox: { type: String, default: undefined },
          outbox: { type: String, default: undefined },
          icon: { type: String, default: undefined },
          url: { type: String, default: undefined },
          server: { type: String },
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now },
          status: {
            type: String,
            enum: ["Interested", "Attending"],
            default: "pending",
          },
        },
      ],
      default: [],
    },
    invited: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, default: undefined },
          inbox: { type: String, default: undefined },
          outbox: { type: String, default: undefined },
          icon: { type: String, default: undefined },
          url: { type: String, default: undefined },
          server: { type: String },
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    }, // Pending members
    memberCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    flaggedAt: { type: Date, default: null },
    flaggedBy: { type: String, default: null },
    flaggedReason: { type: String, default: null },
    deletedAt: { type: Date, default: null }, // If the event is deleted, when it was deleted
    deletedBy: { type: String, default: null }, // I`f the event is deleted, who deleted it (usually the user unless an admin does it)
    url: { type: String, default: undefined },
  },
  {
    strict: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

EventSchema.pre("save", async function (next) {
  if (this.admins.length === 0) this.admins = [this.actorId];
  // Create the event id and url
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `event:${this._id}@${domain}`;
  this.url = this.url || `https://${domain}/events/${this.id}`;
  this.server =
    this.server || (await Settings.findOne({ name: "actorId" })).value;
  next();
});

export default mongoose.model("Event", EventSchema);
