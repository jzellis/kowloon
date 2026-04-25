import mongoose from "mongoose";
import { marked } from "marked";
import { signData, verifyData } from "#methods/utils/signing.js";
import { Settings, User, React, Reply, Circle } from "./index.js";
import GeoPoint from "./subschema/GeoPoint.js";
import ActorSchema from "./subschema/Actor.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
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
    actor: { type: ActorSchema, default: undefined },
    server: { type: String, default: undefined }, // The server of the post's author
    title: { type: String, default: undefined }, // An optional title for post types other than Notes
    summary: { type: String, default: undefined }, // An optional summary for post types other than Notes
    source: {
      content: { type: String, default: "" }, // The raw content of the post -- plain text, HTML or Markdown
      mediaType: { type: String, default: "text/markdown" },
      contentEncoding: { type: String, default: "utf-8" },
      language: { type: String, default: "en" },
    },
    body: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    reactPreview: { type: String, default: null }, // Most-used emoji react
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    image: { type: String, default: undefined }, // The post's featured/preview image (File ID or URL for backwards compatibility)
    attachments: { type: [String], default: [] }, // Array of File IDs
    tags: { type: [String], default: [] },
    location: { type: GeoPoint, default: undefined }, // A geotag for the post in the ActivityStreams geolocation format
    event: {
      startDate: { type: Date, default: undefined }, // A start time for Event posts
      endDate: { type: Date, default: undefined }, // An end time for Event posts
      rsvp: { type: String },
    },
    target: { type: String, default: undefined }, // For Links
    to: { type: String, default: "" },
    canReply: { type: String, default: "" },
    canReact: { type: String, default: "" },
    deletedAt: { type: Date, default: null }, // If this post was deleted, this is when it was deleted. If it's not set the post is not deleted
    deletedBy: { type: String, default: null }, // I`f the activity is deleted, who deleted it (usually the user unless an admin does it)
    signature: Buffer, // The creator's public signature for verification
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
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

PostSchema.virtual("attachmentFiles", {
  ref: "File",
  localField: "attachments",
  foreignField: "id",
});

// Helper function to generate body from source.content
function generateBody(source) {
  if (!source || !source.content) return "";

  const mediaType = source.mediaType || "text/markdown";

  switch (mediaType) {
    case "text/markdown":
      return `<p>${marked(source.content)}</p>`;
    case "text/html":
      return source.content;
    default:
      return `<p>${source.content.replace(/(?:\r\n|\r|\n)/g, "</p><p>")}</p>`;
  }
}

PostSchema.pre("save", async function (next) {
  try {
    const { domain, actorId } = getServerSettings();
    this.title = this.title && this.title.trim();
    this.id = this.id || `post:${this._id}@${domain}`;
    this.url = this.url || `https://${domain}/posts/${this.id}`;
    this.server = this.server || actorId;
    this.source.mediaType = this.source.mediaType || "text/markdown";

    // Generate body from source
    this.body = generateBody(this.source);
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

    let actor = await User.findOne({ id: this.actorId });
    if (actor) {
      this.signature = actor.sign(`${this.id}|${this.source.content}`);
    }

    if (this.type === "Event") {
      if (!this.event.rsvp) {
        let rsvpCircle = await Circle.create({
          title: `${this.title} RSVP`,
          to: this.to,
        });
        this.rsvp = rsvpCircle.id;
      }
    }

    // reactCount and replyCount are managed by the Reply/React ActivityParser handlers
    // via findOneAndUpdate($inc). Do not recalculate here — it would overwrite handler increments.
    next();
  } catch (e) {
    console.log(e);
  }
});

PostSchema.pre("updateOne", async function (next) {
  const update = this.getUpdate();

  if (update?.$set?.source?.content !== undefined) {
    const currentDoc = await this.model.findOne(this.getQuery()).lean();
    const newSource = { ...(currentDoc?.source || {}), ...update.$set.source };

    update.$set.body = generateBody(newSource);
    update.$set.wordCount = update.$set.body.replace(/<[^>]*>/g, "").replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(" ").length;
    update.$set.charCount = update.$set.body.replace(/<[^>]*>/g, "").length;

    const actor = await User.findOne({ id: currentDoc.actorId });
    if (actor) {
      update.$set.signature = actor.sign(`${currentDoc.id}|${newSource.content}`);
    }
  }

  next();
});

PostSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  if (update?.$set?.source?.content) {
    const currentDoc = await this.model.findOne(this.getQuery()).lean();
    const newSource = {
      ...(currentDoc?.source || {}),
      ...update.$set.source,
    };

    update.$set.body = generateBody(newSource);

    const actor = await User.findOne({ id: currentDoc.actorId });
    if (actor) {
      update.$set.signature = actor.sign(`${currentDoc.id}|${newSource.content}`);
    }
  }

  next();
});

PostSchema.methods.verifySignature = async function () {
  const actor = await User.findOne({ id: this.actorId });
  if (!actor) return false;
  return actor.verify(`${this.id}|${this.source.content}`, this.signature);
};

const Post = mongoose.model("Post", PostSchema);
export { Post, PostSchema };
