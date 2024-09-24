import mongoose from "mongoose";
import User from "./User.js";
import Settings from "./Settings.js";
import Activity from "./Activity.js";
import Circle from "./Circle.js";
import Group from "./Group.js";
import Bookmark from "./Bookmark.js";
import Like from "./Like.js";
import tensify from "tensify";
import crypto from "crypto";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
import follow from "../methods_bak/follow.js";

const ActivitySchema = new Schema(
  {
    id: { type: String, key: true }, // This is different from the _id, this is the global UUID of the activity.
    actorId: { type: String, required: true }, // The actor ID of the activity's author. Required.
    type: { type: String, default: "Create" },
    object: { type: Object, default: undefined }, // The object of the Activity.
    objectType: { type: String, default: undefined }, // This should be the same as the collection name, i.e. Post, Like, Circle, etc.
    objectId: { type: String, default: undefined }, // The ID of the activity's object (if it's a Post, Like, Circle or other created or modified thing)
    target: { type: String, default: undefined }, // If this activity targets another object, this is the ID of that object (if it's a like or a reply, for example)
    to: { type: [String], default: undefined }, // If the post is public, this is set to "_public@server.name"; if it's server-only, it's set to "_server@server.name"; if it's a DM it's set to the recipient(s)
    bto: { type: [String], default: undefined }, // This is for posts to Circles
    cc: { type: [String], default: undefined }, // This is for posts to publicGroups or tagging people in
    bcc: { type: [String], default: undefined }, // This is for posts to private Groups
    summary: { type: String, default: undefined }, // A summary of the activity generated by the user/app or by the system if none is provided
    public: { type: Boolean, default: false }, // Is the activity visible to the public (via the Web or apps) or not?

    flagged: { type: Object, default: false }, // Has this activity been flagged? If so, it'll include a reason, who flagged it and when.
    deletedAt: { type: Date, default: null }, // If the activity is deleted, when it was deleted
    deletedBy: { type: String, default: null }, // I`f the activity is deleted, who deleted it (usually the user unless an admin does it)
    url: { type: String, default: undefined },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ActivitySchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

ActivitySchema.virtual("likes", {
  ref: "Like",
  localField: "id",
  foreignField: "target",
});

ActivitySchema.pre("save", async function (next) {
  // Create the activity id and url
  const domain = (await Settings.findOne({ name: "domain" })).value;

  this.id = this.id || `activity:${this._id}@${domain}`;
  this.url = this.url || `//${domain}/activities/${this._id}`;

  next();
});

export default mongoose.model("Activity", ActivitySchema);
