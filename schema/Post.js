import mongoose from "mongoose";
import { marked } from "marked";
import crypto from "crypto";
import { Feed, Settings, User } from "./index.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const PostSchema = new Schema(
  {
    id: { type: String, key: true },
    objectType: { type: String, default: "Post" },
    type: { type: String, default: "Note" }, // The type of post this is
    url: { type: String }, // The URL of the post
    href: { type: String, default: undefined }, // If the post is a link, this is what it links to
    actorId: { type: String }, // The ID of the post's author
    actor: { type: Object, defalt: undefined },

    title: { type: String, default: undefined }, // An optional title for post types other than Notes
    summary: { type: String, default: undefined }, // An optional summary for post types other than Notes
    source: {
      content: { type: String, default: "" }, // The raw content of the post -- plain text, HTML or Markdown
      mediaType: { type: String, default: "text/html" },
      contentEncoding: { type: String, default: "utf-8" },
    },
    body: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    image: { type: String, default: undefined }, // The post's featured/preview image
    attachments: { type: [Object], default: [] }, // Any post attachments. Each attachment is an object with a filetype, size, url where it's stored and optional title and description
    tags: { type: [String], default: [] },
    location: { type: Object, default: undefined }, // A geotag for the post in the ActivityStreams geolocation format
    target: { type: String, default: undefined }, // For Links
    to: { type: String, default: "" },
    replyTo: { type: String, default: "" },
    reactTo: { type: String, default: "" },
    flaggedAt: { type: Date, default: null },
    flaggedBy: { type: String, default: null },
    flaggedReason: { type: String, default: null },
    deletedAt: { type: Date, default: null }, // If this post was deleted, this is when it was deleted. If it's not set the post is not deleted
    deletedBy: { type: String, default: null }, // I`f the activity is deleted, who deleted it (usually the user unless an admin does it)
    signature: Buffer, // The creator's public signature for verification
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

PostSchema.index({
  title: "text",
  source: "text",
  "source.content": "text",
  "location.name": "text",
});

PostSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

PostSchema.virtual("replies", {
  ref: "Reply",
  localField: "id",
  foreignField: "target",
});

PostSchema.pre("save", async function (next) {
  try {
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.title = this.title && this.title.trim();
    this.id = this.id || `post:${this._id}@${domain}`;
    this.url = this.url || `https://${domain}/posts/${this.id}`;
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
    this.wordCount =
      this.wordCount ||
      this.body
        .replace(/<[^>]*>/g, "")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(" ").length;
    this.charCount = this.charCount || this.body.replace(/<[^>]*>/g, "").length;
    this.summary =
      this.summary ||
      `<p>${this.body
        .match(/(?<=<p.*?>)(.*?)(?=<\/p>)/g)
        .slice(0, 3)
        .join("</p>")
        .trim()}${
        this.body.match(/(?<=<p.*?>)(.*?)(?=<\/p>)/g).length > 3 ? " ..." : ""
      }</p>`;

    let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor
    // Sign this post using the user's private key if it's not signed
    if (actor) {
      let stringject = Buffer.from(`${this.id} | ${this.createdAt}`);
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(stringject);
      this.signature = sign.sign(actor.privateKey, "base64");
    }
    next();
  } catch (e) {
    console.log(e);
  }
});

PostSchema.pre("updateOne", async function (next) {
  this.source.mediaType = this.source.mediaType || "text/html";
  switch (this.source.mediaType) {
    case "text/markdown":
      this.body = `${marked(this.source.content)}`;
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

  let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor

  next();
});

PostSchema.methods.verifySignature = async function () {
  let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor
  let stringject = Buffer.from(JSON.stringify(this.id));
  return crypto.verify(
    "RSA-SHA256",
    stringject,
    actor.publicKey,
    this.signature
  );
};

const Post = mongoose.model("Post", PostSchema);
export { Post, PostSchema };
