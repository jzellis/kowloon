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
    summary: { type: String, default: undefined },
    icon: { type: String, default: undefined },
    members: {
      type: [
        {
          id: { type: String, required: true },
          serverId: { type: String },
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
    to: { type: [String], default: [] },
    replyTo: { type: [String], default: [] },
    reactTo: { type: [String], default: [] },
    replyCount: { type: Number, default: 0 }, // The number of replies to this post
    reactCount: { type: Number, default: 0 }, // The number of likes to this post
    shareCount: { type: Number, default: 0 }, // The number of shares of this post
    deletedAt: { type: Date, default: null },
    url: { type: String, default: undefined },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CircleSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

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
    this.url = this.url || `//${domain}/circles/${this.id}`;

    this.icon = this.icon || `https://${domain}/images/circle.png`;
  }
  next();
});

export default mongoose.model("Circle", CircleSchema);
