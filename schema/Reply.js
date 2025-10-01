import mongoose from "mongoose";
import { marked } from "marked";
import crypto from "crypto";
import { Settings, User } from "./index.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const ReplySchema = new Schema(
  {
    id: { type: String, key: true },
    actorId: { type: String },
    actor: { type: Object, default: undefined },
    server: { type: String, default: undefined }, // The server of the actor
    target: { type: String, required: true },
    targetActorId: { type: String, required: true },

    parent: { type: String, default: null },
    href: { type: String },
    source: {
      content: { type: String, default: "" },
      mediaType: { type: String, default: "text/html" },
    },
    body: { type: String, default: "" },
    image: { type: String, default: undefined },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
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

ReplySchema.pre("save", async function (next) {
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `reply:${this._id}@${domain}`;
  this.url = this.url || `https://${domain}/posts/${this.id}`;
  this.server =
    this.server || (await Settings.findOne({ name: "actorId" })).value;
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

  if (!this.parent) this.parent = this.target;
  // let stringject = Buffer.from(this.id);
  // const sign = crypto.createSign("RSA-SHA256");
  // sign.update(stringject);
  // this.signature = sign.sign(actor.privateKey, "base64");

  next();
});

ReplySchema.methods.verifySignature = async function () {
  let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor
  let stringject = Buffer.from(JSON.stringify(this.id));
  return crypto.verify(
    "RSA-SHA256",
    stringject,
    actor.publicKey,
    this.signature
  );
};

export default mongoose.model("Reply", ReplySchema);
