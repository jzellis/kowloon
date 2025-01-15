import mongoose from "mongoose";
import Settings from "./Settings.js";

const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const BookmarkSchema = new Schema(
  {
    id: { type: String, key: true },
    target: { type: String, required: false },
    href: { type: String, required: false },
    title: { type: String, default: undefined },
    actorId: { type: String, required: true },
    tags: { type: [String], default: [] },
    summary: { type: String, default: undefined },
    image: { type: String, default: undefined },
    to: { type: [String], default: [] }, // If the post is public, this is set to "@public"; if it's server-only, it's set to "@server"; if it's a DM it's set to the recipient(s)
    cc: { type: [String], default: [] }, // This is for posts to publicGroups or tagging people in
    bcc: { type: [String], default: [] }, // This is for posts to private Groups
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null }, // I`f the activity is deleted, who deleted it (usually the user unless an admin does it)
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

BookmarkSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

BookmarkSchema.pre("save", async function (next) {
  if (this.isNew) {
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.id = this.id || `bookmark:${this._id}@${domain}`;
    this.url = this.url || `//${domain}/bookmarks/${this.id}`;

    this.image = this.image || `https://${domain}/images/bookmark.png`;

    if (!this.title) this.title = this.href;
  }
  next();
});

export default mongoose.model("Bookmark", BookmarkSchema);
