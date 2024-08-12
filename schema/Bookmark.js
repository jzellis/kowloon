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
    public: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
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
    this.image = this.image || `//${domain}/images/bookmark.png`;

    if (!this.title) this.title = this.href;
  }
  next();
});

export default mongoose.model("Bookmark", BookmarkSchema);
