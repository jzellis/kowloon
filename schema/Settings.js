import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const SettingsSchema = new Schema({
  name: String,
  value: Schema.Types.Mixed,
  summary: String,
  public: { type: Boolean, default: true },
  ui: {
    type: { type: String, default: "text" },
    options: Object,
  },
  deletedAt: Date,
});

const Settings = mongoose.model("Settings", SettingsSchema);

export default Settings;
