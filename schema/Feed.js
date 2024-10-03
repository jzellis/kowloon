import mongoose from "mongoose";
import { Settings } from "./index.js";
const Schema = mongoose.Schema;

const FeedSchema = new Schema(
  {
    id: { type: String },
    type: { type: String, default: "Article" },
    to: { type: [String] },
    cc: { type: [String] },
    bcc: { type: [String] },
    item: {
      id: { type: String, required: true }, // maps to object.id or for RSS, the guid
      title: { type: String },
      content_text: { type: String },
      content_html: { type: String }, // maps to object.content.source
      url: { type: String, required: true }, // Same as object.url
      external_url: { type: String }, // maps to object.href
      image: { type: String }, // maps t object.featuredImage
      banner_image: { type: String },
      date_published: { type: Date },
      date_modified: { type: Date },
      author: { type: Schema.Types.Mixed },
      tags: { type: [String], default: [] },
    },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

FeedSchema.pre("save", async function (next) {
  // Create the activity id and url
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `feed:${this._id}@${domain}`;
  next();
});

export default mongoose.model("Feed", FeedSchema);
