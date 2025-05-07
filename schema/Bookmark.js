import mongoose from "mongoose";
import Settings from "./Settings.js";
import { marked } from "marked";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const BookmarkSchema = new Schema(
  {
    id: { type: String, key: true },
    objectType: { type: String, default: "Bookmark" },
    type: { type: String, enum: ["Bookmark", "Folder"], default: "Bookmark" },
    parentFolder: { type: String, default: undefined, required: false },
    target: { type: String, required: false, default: undefined },
    href: { type: String, required: false, default: undefined },
    title: { type: String, default: undefined },
    actorId: { type: String, required: true },
    actor: { type: Object, default: undefined },
    tags: { type: [String], default: [] },
    summary: { type: String, default: undefined },
    source: {
      content: { type: String, default: "" }, // The raw content of the post -- plain text, HTML or Markdown
      mediaType: { type: String, default: "text/html" },
    },
    body: { type: String, default: "" },
    image: { type: String, default: undefined },
    to: { type: String, default: "" },
    replyTo: { type: String, default: "" },
    reactTo: { type: String, default: "" },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null }, // I`f the activity is deleted, who deleted it (usually the user unless an admin does it),
    url: { type: String, default: undefined },
  },
  {
    strict: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

BookmarkSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

BookmarkSchema.pre("save", async function (next) {
  if (this.isNew) {
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.id = this.id || `bookmark:${this._id}@${domain}`;
    this.url = this.url || `//${domain}/bookmarks/${this.id}`;

    this.image = this.image || `https://${domain}/images/bookmark.png`;

    if (!this.title) this.title = this.href;
    this.source.mediaType = this.source.mediaType || "text/html";

    switch (this.source.mediaType) {
      case "text/markdown":
        this.body = `<p>${marked(this.source.content)}</p>`;
        break;
      case "text/html":
        this.body = this.source.content;
        break;
      default:
        this.body = `<p>${this.source.content.replace(
          /(?:\r\n|\r|\n)/g,
          "</p><p>"
        )}</p>`;
        break;
    }
  }
  next();
});

export default mongoose.model("Bookmark", BookmarkSchema);
