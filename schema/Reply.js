import mongoose from "mongoose";
import { marked } from "marked";
import crypto from "crypto";
import { Settings, User } from "./index.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const replieschema = new Schema(
  {
    id: { type: String, key: true },
    objectType: { type: String, default: "Reply" },
    target: { type: String, required: true },
    url: { type: String },
    link: { type: String },
    actorId: { type: String },
    source: {
      content: { type: String, default: "" },
      mediaType: { type: String, default: "text/html" },
    },
    image: { type: String, default: undefined },
    attachments: { type: [Object], default: [] },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    flagged: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    url: { type: String, default: undefined },
    signature: Buffer,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "replies",
  }
);

replieschema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

replieschema.pre("save", async function (next) {
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `reply:${this._id}@${domain}`;
  this.url = this.url || `https://${domain}/posts/${this.id}`;
  this.source.mediaType = this.source.mediaType || "text/html";

  if (this.source.mediaType.includes("markdown"))
    this.content = `${marked(this.source.content)}`;
  let actor = this.actor || (await User.findOne({ id: this.actorId }));
  let stringject = Buffer.from(this.id);
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(stringject);
  this.signature = sign.sign(actor.privateKey, "base64");

  next();
});

replieschema.methods.verifySignature = async function () {
  let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor
  let stringject = Buffer.from(JSON.stringify(this.id));
  return crypto.verify(
    "RSA-SHA256",
    stringject,
    actor.publicKey,
    this.signature
  );
};

export default mongoose.model("Reply", replieschema);
