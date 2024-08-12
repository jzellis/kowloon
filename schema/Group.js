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
    public: { type: Boolean, default: false },
    approval: { type: Boolean, default: false }, // If members must be approved to join
    flagged: { type: Object, default: false }, // Has this group been flagged? If so, it'll include a reason, who flagged it and when.
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
    this.url = this.url || `//${domain}/groups/${this._id}`;
    this.icon = this.icon || `//${domain}/images/group.png`;
  }
  next();
});

export default mongoose.model("Group", GroupSchema);
