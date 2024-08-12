import mongoose from "mongoose";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
import { Settings } from "./index.js";

const LikeSchema = new Schema(
  {
    id: { type: String, key: true },
    target: { type: String, required: true },
    actorId: { type: String, required: true },
    type: { type: Object, required: true },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

LikeSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

LikeSchema.pre("save", async function (next) {
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `like:${this._id}@${domain}`;
  next();
});
export default mongoose.model("Like", LikeSchema);
