import mongoose from "mongoose";
const Schema = mongoose.Schema;

const UserFeedSchema = new Schema(
  {
    actorId: { type: String, required: true },
    circleId: { type: String, required: true },
    postId: { type: String, key: true },
    type: { type: String, default: "Post" },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }, //30 days
    read: { type: Boolean, default: false },
    canReply: { type: Boolean, default: false },
    canReact: { type: Boolean, default: false },
    canShare: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const UserFeed = mongoose.model("UserFeed", UserFeedSchema);
export default UserFeed;
