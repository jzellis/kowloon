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
    // Widget type: text | textarea | boolean | number | select | multiselect |
    //              email | url | color | json | markdown | image | redacted
    type: { type: String, default: "text" },
    label: { type: String },          // Human-readable name for the admin UI
    group: { type: String },          // Panel/section grouping (e.g. "appearance", "registration")
    order: { type: Number, default: 0 }, // Display order within the group
    options: Object,                  // Widget-specific config (choices, min/max, placeholder, rows…)
  },
  deletedAt: Date,
});

const Settings = mongoose.model("Settings", SettingsSchema);

export default Settings;
