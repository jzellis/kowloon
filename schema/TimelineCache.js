import mongoose from "mongoose";
const Schema = mongoose.Schema;

const TimelineCacheSchema = new Schema(
  {
    id: { type: String, key: true },
    objectType: { type: String, default: "Post" },
    type: { type: String, default: "Note" }, // The type of post this is
    url: { type: String }, // The URL of the post
    href: { type: String, default: undefined }, // If the post is a link, this is what it links to
    actorId: { type: String }, // The ID of the post's author
    actor: { type: Object, default: undefined },
    server: { type: String, default: undefined }, // The server of the post's author
    group: { type: Object, default: undefined },
    title: { type: String, default: undefined }, // An optional title for post types other than Notes
    summary: { type: String, default: undefined }, // An optional summary for post types other than Notes
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
    deletedAt: { type: Date, default: null }, // If this post was deleted, this is when it was deleted. If it's not set the post is not deleted
    deletedBy: { type: String, default: null }, // I`f the activity is deleted, who deleted it (usually the user unless an admin does it)
    signature: Buffer, // The creator's public signature for verification
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "TimelineCache",
  }
);

TimelineCacheSchema.index({
  title: "text",
  source: "text",
  "source.content": "text",
  "location.name": "text",
});

TimelineCacheSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

TimelineCacheSchema.virtual("replies", {
  ref: "Reply",
  localField: "id",
  foreignField: "target",
});

TimelineCacheSchema.pre("save", async function (next) {
  next();
});

TimelineCacheSchema.pre("updateOne", async function (next) {
  next();
});

const TimelineCache = mongoose.model("TimelineCache", TimelineCacheSchema);
export default TimelineCache;
