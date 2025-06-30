import mongoose from "mongoose";
import Settings from "./Settings.js";
const Schema = mongoose.Schema;
import { randomBytes } from "crypto";
import QRCode from "qrcode";

const InviteSchema = new Schema(
  {
    actorId: { type: String, required: true }, // This is who's creating the invite
    server: { type: String, default: undefined }, // The server of the actor
    email: { type: String }, // Can be optionally used to send invitation
    code: { type: String },
    qrCode: String,
    url: String,
    expiresAt: { type: Date },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

InviteSchema.pre("save", async function (next) {
  if (!this.key) this.key = randomBytes(32).toString("hex");
  if (!this.url) {
    const domain = (await Settings.findOne({ name: "domain" })).value;
    this.url = `https://${domain}/invites/${this.key}`;
    this.server =
      this.server || (await Settings.findOne({ name: "actorId" })).value;
  }
  this.qrCode = await QRCode.toDataURL(this.url);
  next();
});

export default mongoose.model("Invite", InviteSchema);
