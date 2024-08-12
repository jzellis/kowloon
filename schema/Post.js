import mongoose from "mongoose";
import { marked } from "marked";
import crypto from "crypto";
import { Settings, User } from "./index.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const PostSchema = new Schema(
  {
    id: { type: String, key: true },
    type: { type: String, default: "Note" },
    url: { type: String },
    link: { type: String, default: undefined },
    actorId: { type: String },
    title: { type: String, default: undefined },
    summary: { type: String, default: undefined },
    source: {
      content: { type: String, default: "" },
      mediaType: { type: String, default: "text/html" },
    },
    featuredImage: { type: String, default: undefined },
    attachments: { type: [Object], default: [] },
    location: { type: Object, default: undefined },
    public: { type: Boolean, default: false },
    publicReplies: { type: Boolean, default: false },
    circleReplies: String, // which Circle can reply to this post
    circles: [String], // which circles can see this post
    groups: [String],
    to: { type: [String], default: undefined },
    bto: { type: [String], default: undefined },
    cc: { type: [String], default: undefined },
    bcc: { type: [String], default: undefined },
    flagged: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    signature: Buffer,
    checksum: { type: String },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

PostSchema.virtual("likes", {
  ref: "Like",
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
  this.url = this.url || `//${domain}/posts/${this._id}`;
  this.source.mediaType = this.source.mediaType || "text/html";

  if (this.source.mediaType.includes("markdown"))
    this.content = `${marked(this.source.content)}`;

  let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor

  // Sign this post using the user's private key if it's not signed
  let stringject = Buffer.from(this.id);
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(stringject);
  this.signature = sign.sign(actor.keys.private, "base64");
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
