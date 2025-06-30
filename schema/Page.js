import mongoose from "mongoose";
import { marked } from "marked";
import crypto from "crypto";
import { Settings, User } from "./index.js";
import { type } from "os";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const slugify = function (str) {
  str = str.replace(/^\s+|\s+$/g, ""); // trim
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  var to = "aaaaeeeeiiiioooouuuunc------";
  for (var i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), "g"), to.charAt(i));
  }

  str = str
    .replace(/[^a-z0-9 -]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // collapse whitespace and replace by -
    .replace(/-+/g, "-"); // collapse dashes

  return str;
};

const PageSchema = new Schema(
  {
    id: { type: String, key: true },
    objectType: { type: String, default: "Page" },
    type: { type: String, default: "Page", enum: ["Page", "Folder"] }, // The type of page this is
    parentFolder: { type: String, default: null },
    order: { type: Number, default: 0 },
    url: { type: String }, // The URL of the page
    href: { type: String, default: undefined }, // If the page is a link, this is what it links to
    actorId: { type: String }, // The ID of the page's author
    actor: { type: Object, default: undefined },
    server: { type: String, default: undefined }, // The server of the page's author
    title: { type: String, required: true }, // An optional title for page types other than Notes
    slug: { type: String, default: undefined },
    summary: { type: String, default: undefined }, // An optional summary for page types other than Notes
    source: {
      content: { type: String, default: "" }, // The raw content of the page -- plain text, HTML or Markdown
      mediaType: { type: String, default: "text/html" },
      contentEncoding: { type: String, default: "utf-8" },
    },
    body: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 }, // The number of replies to this page
    reactCount: { type: Number, default: 0 }, // The number of likes to this page
    shareCount: { type: Number, default: 0 }, // The number of shares of this page
    image: { type: String, default: undefined }, // The page's featured/preview image
    attachments: { type: [Object], default: [] }, // Any page attachments. Each attachment is an object with a filetype, size, url where it's stored and optional title and description
    tags: { type: [String], default: [] },
    to: { type: String, default: "" },
    replyTo: { type: String, default: "" },
    reactTo: { type: String, default: "" },
    flaggedAt: { type: Date, default: null },
    flaggedBy: { type: String, default: null },
    flaggedReason: { type: String, default: null },
    deletedAt: { type: Date, default: null }, // If this page was deleted, this is when it was deleted. If it's not set the page is not deleted
    deletedBy: { type: String, default: null }, // I`f the activity is deleted, who deleted it (usually the user unless an admin does it)
    signature: Buffer, // The creator's public signature for verification
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

PageSchema.index({
  title: "text",
  source: "text",
  "source.content": "text",
  "location.name": "text",
});

PageSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

PageSchema.virtual("replies", {
  ref: "Reply",
  localField: "id",
  foreignField: "target",
});

PageSchema.pre("save", async function (next) {
  try {
    this.slug = this.slug || slugify(this.title);

    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.title = this.title && this.title.trim();
    this.id = this.id || `page:${this._id}@${domain}`;
    this.url = this.url || `https://${domain}/pages/${this.slug}`;
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
    this.wordCount =
      this.wordCount ||
      this.body
        .replace(/<[^>]*>/g, "")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(" ").length;
    this.charCount = this.charCount || this.body.replace(/<[^>]*>/g, "").length;
    // this.summary =
    //   this.summary ||
    //   `<p>${this.body
    //     .match(/(?<=<p.*?>)(.*?)(?=<\/p>)/g)
    //     .slice(0, 3)
    //     .join("</p>")
    //     .trim()}${
    //     this.body.match(/(?<=<p.*?>)(.*?)(?=<\/p>)/g).length > 3 ? " ..." : ""
    //   }</p>`;

    let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor
    // Sign this page using the user's private key if it's not signed
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

PageSchema.pre("updateOne", async function (next) {
  this.slug = this.slug || slugify(this.title);
  this.url = this.url || `https://${domain}/pages/${this.slug}`;

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

  this.wordCount =
    this.wordCount ||
    this.body
      .replace(/<[^>]*>/g, "")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .split(" ").length;
  this.charCount = this.charCount || this.body.replace(/<[^>]*>/g, "").length;

  let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor

  next();
});

PageSchema.methods.verifySignature = async function () {
  let actor = await User.findOne({ id: this.actorId }); // Retrieve the activity actor
  let stringject = Buffer.from(JSON.stringify(this.id));
  return crypto.verify(
    "RSA-SHA256",
    stringject,
    actor.publicKey,
    this.signature
  );
};

export default mongoose.model("Page", PageSchema);
