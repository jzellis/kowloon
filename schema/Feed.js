import mongoose from "mongoose";
import { Settings } from "./index.js";
const Schema = mongoose.Schema;
import { PostSchema } from "./Post.js";

const FeedSchema = new Schema(
  {
    id: { type: String, key: true },
    type: { type: String, default: "Note" }, // The type of post this is
    objectType: { type: String, default: "Post" },
    url: { type: String }, // The URL of the post
    href: { type: String, default: undefined }, // If the post is a link, this is what it links to
    actor: { type: Object }, // The ID of the post's author
    group: { type: Object },
    title: { type: String, default: undefined }, // An optional title for post types other than Notes
    summary: { type: String, default: undefined }, // An optional summary for post types other than Notes
    body: { type: String, default: undefined },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    image: { type: String, default: undefined }, // The post's featured/preview image
    attachments: { type: [Object], default: [] }, // Any post attachments. Each attachment is an object with a filetype, size, url where it's stored and optional title and description
    tags: { type: [String], default: [] },
    location: { type: Object, default: undefined }, // A geotag for the post in the ActivityStreams geolocation format
    target: { type: String, default: undefined }, // For Links
    to: { type: [String], default: [] }, // If the post is public, this is set to "_public@server.name"; if it's server-only, it's set to "_server@server.name"; if it's a DM it's set to the recipient(s)
    reactTo: { type: [String], default: ["@server"] },
    retrievedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

FeedSchema.index({
  title: "text",
  source: "text",
  body: "text",
  "location.name": "text",
});

export default mongoose.model("Feed", FeedSchema);
