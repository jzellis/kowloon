import mongoose from "mongoose";
import { Settings } from "./index.js";
const Schema = mongoose.Schema;

const FedServerSchema = new Schema(
  {
    id: { type: String }, // The user, server or RSS feed's ID
    domain: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, default: "kowloon" },
    name: { type: String },
    status: { type: Number },
    lastAccessed: { type: Date },
    followers: { type: [String], default: [] },
    publicKey: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

FedServerSchema.pre("save", async function (next) {
  // Create the activity id and url
  const domain = (await Settings.findOne({ name: "domain" })).value;
  // this.id = this.id || `server:${this._id}@${domain}`;
  next();
});

export default mongoose.model("FedServer", FedServerSchema);
