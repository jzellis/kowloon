import mongoose from "mongoose";
import Settings from "./Settings.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
import GeoPoint from "./subschema/GeoPoint.js";

const FileSchema = new Schema(
  {
    id: { type: String, key: true },
    originalFileName: { type: String, default: undefined },
    type: { type: String, default: "File" },
    title: { type: String, default: undefined },
    summary: { type: String, default: undefined },
    url: { type: String, default: undefined },
    location: { type: GeoPoint, default: undefined },
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
    const { domain, actorId } = getServerSettings();
    this.id = this.id || `file:${this._id}@${domain}`;
    this.url =
      this.url || `https://${domain}/files/${this.id}.${this.extension}`;
    this.server = this.server || actorId;
  }
  next();
});

export default mongoose.model("File", FileSchema);
