import mongoose from "mongoose";
import { marked } from "marked";
import crypto from "crypto";
import { Settings, User } from "./index.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const PostSchema = new Schema(
  {
    id: { type: String, key: true },
    type: { type: String, default: "Note" }, // The type of post this is
    url: { type: String }, // The URL of the post
    href: { type: String, default: undefined }, // If the post is a link, this is what it links to
    actorId: { type: String }, // The ID of the post's author
    title: { type: String, default: undefined }, // An optional title for post types other than Notes
    summary: { type: String, default: undefined }, // An optional summary for post types other than Notes
    source: {
      content: { type: String, default: "" }, // The raw content of the post -- plain text, HTML or Markdown
      mediaType: { type: String, default: "text/html" },
    },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    likeCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    image: { type: String, default: undefined }, // The post's featured/preview image
    attachments: { type: [ObjectId], ref: "File", default: [] }, // Any post attachments. Each attachment is an object with a filetype, size, url where it's stored and optional title and description
    tags: { type: [String], default: [] },
    location: { type: Object, default: undefined }, // A geotag for the post in the ActivityStreams geolocation format
    target: { type: String, default: undefined }, // For replies
    replyTo: { type: [String], default: [] }, // Who can reply. If this is set to "@public@server.name", anyone can reply; if "@_recipients@server.name", only people in the recipients list can reply; if "@_server@server.name", only users belonging to the server can reply; if circles or groups are listed, only people in those Circles or Groups can reply. If it's empty, no one can reply.
    to: { type: [String], default: [] }, // If the post is public, this is set to "_public@server.name"; if it's server-only, it's set to "_server@server.name"; if it's a DM it's set to the recipient(s)
    cc: { type: [String], default: [] }, // This is for posts to publicGroups or tagging people in
    bcc: { type: [String], default: [] }, // This is for posts to private Groups
    flaggedAt: { type: Date, default: null },
    flaggedBy: { type: String, default: null },
    flaggedReason: { type: String, default: null },
    deletedAt: { type: Date, default: null }, // If this post was deleted, this is when it was deleted. If it's not set the post is not deleted
    deletedBy: { type: String, default: null }, // I`f the activity is deleted, who deleted it (usually the user unless an admin does it)
    signature: Buffer, // The creator's public signature for verification
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

PostSchema.virtual("likes", {
  ref: "Like",
  localField: "id",
  foreignField: "target",
});

PostSchema.virtual("replies", {
  ref: "Reply",
  localField: "id",
  foreignField: "target",
});

PostSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

PostSchema.index({
  title: "text",
  source: "text",
  "source.content": "text",
  "location.name": "text",
});

PostSchema.pre("save", async function (next) {
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.title = this.title && this.title.trim();
  this.id = this.id || `post:${this._id}@${domain}`;
  this.url = this.url || `https://${domain}/posts/${this.id}`;
  this.source.mediaType = this.source.mediaType || "text/html";
  if (this.source.mediaType.includes("markdown"))
    this.source.content = `${marked(this.source.content)}`;

  let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor

  // Sign this post using the user's private key if it's not signed
  let stringject = Buffer.from(this.id);
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(stringject);
  this.signature = sign.sign(actor.keys.private, "base64");
  next();
});

PostSchema.pre("updateOne", async function (next) {
  this.source.mediaType = this.source.mediaType || "text/html";
  if (this.source.mediaType.includes("markdown"))
    this.source.content = `${marked(this.source.content)}`;
  next();
});

PostSchema.methods.verifySignature = async function () {
  let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor
  let stringject = Buffer.from(JSON.stringify(this.id));
  return crypto.verify(
    "RSA-SHA256",
    stringject,
    actor.keys.public,
    this.signature
  );
};

export default mongoose.model("Post", PostSchema);
