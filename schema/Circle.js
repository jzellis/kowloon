import mongoose from "mongoose";
import Settings from "./Settings.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const CircleSchema = new Schema(
  {
    id: { type: String, key: true },
    name: { type: String, default: undefined },
    actorId: { type: String, required: true },
    summary: { type: String, default: undefined },
    icon: { type: String, default: undefined },
    members: { type: [String], default: [] },
    public: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CircleSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

CircleSchema.pre("save", async function (next) {
  if (this.isNew) {
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.title = this.title && this.title.trim();
    this.id = this.id || `circle:${this._id}@${domain}`;
    this.icon = this.icon || `//${domain}/images/circle.png`;
  }
  next();
});

export default mongoose.model("Circle", CircleSchema);
