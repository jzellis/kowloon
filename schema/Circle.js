import mongoose from "mongoose";
import Settings from "./Settings.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const CircleSchema = new Schema(
  {
    id: { type: String, key: true },
    objectType: { type: String, default: "Circle" },
    name: { type: String, default: undefined },
    actorId: { type: String, required: true },
    actor: { type: Object, default: undefined },
    server: { type: String, default: undefined },
    summary: { type: String, default: undefined },
    icon: { type: String, default: undefined },
    members: {
      type: [
        {
          id: { type: String, required: true },
          server: { type: String, default: undefined },
          type: { type: String, default: "kowloon" },
          name: { type: String, default: undefined },
          inbox: { type: String, default: undefined },
          outbox: { type: String, default: undefined },
          icon: { type: String, default: undefined },
          url: { type: String, default: undefined },
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    memberCount: { type: Number, default: 0 },
    to: { type: String, default: "" },
    replyTo: { type: String, default: "" },
    reactTo: { type: String, default: "" },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    url: { type: String, default: undefined },
    lastFetchedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CircleSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

CircleSchema.pre("save", async function (next) {
  if (this.isNew) {
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.title = this.title && this.title.trim();
    this.id = this.id || `circle:${this._id}@${domain}`;
    this.url = this.url || `https://${domain}/circles/${this.id}`;
    this.memberCount = this.members.length;
    this.icon = this.icon || `https://${domain}/images/circle.png`;
    this.server =
      this.server || (await Settings.findOne({ name: "actorId" })).value;
  }
  next();
});

export default mongoose.model("Circle", CircleSchema);
