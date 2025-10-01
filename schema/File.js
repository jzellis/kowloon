import mongoose from "mongoose";
import Settings from "./Settings.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const FileSchema = new Schema(
  {
    id: { type: String, key: true },
    originalFileName: { type: String, default: undefined },
    title: { type: String, default: undefined },
    summary: { type: String, default: undefined },
    url: { type: String, default: undefined },
    location: { type: String, default: undefined },
    mimeType: { type: String, default: undefined },
    extension: { type: String, default: undefined },
    size: { type: Number, default: undefined },
    actorId: { type: String, required: true }, // Who created this group?
    server: { type: String, default: undefined }, // The server of the actor
    deletedAt: { type: Date, default: null }, // If the group is deleted, when it was deleted
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

FileSchema.virtual("actor", {
  ref: "User",
  localField: "actorId",
  foreignField: "id",
  justOne: true,
});

FileSchema.pre("save", async function (next) {
  if (this.isNew) {
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.id = this.id || `file:${this._id}@${domain}`;
    this.url =
      this.url || `https://${domain}/files/${this.id}.${this.extension}`;
    this.server =
      this.server || (await Settings.findOne({ name: "actorId" })).value;
  }
  next();
});

export default mongoose.model("File", FileSchema);
