import mongoose from "mongoose";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
import { Settings } from "./index.js";

const ReactSchema = new Schema(
  {
    id: { type: String, key: true },
    type: { type: String, default: "React" },
    target: { type: String, required: true },
    actorId: { type: String, required: true },
    actor: { type: Object, default: undefined },
    server: { type: String, default: undefined },
    emoji: { type: String, required: true },
    name: { type: String, required: true },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ReactSchema.pre("save", async function (next) {
  const domain = (await Settings.findOne({ name: "domain" })).value;
  this.id = this.id || `react:${this._id}@${domain}`;
  this.server =
    this.server || (await Settings.findOne({ name: "actorId" })).value;
  next();
});
export default mongoose.model("React", ReactSchema);
