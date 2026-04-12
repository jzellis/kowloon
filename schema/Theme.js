// Theme schema for Kowloon
// Themes are stored as individual documents and injected as CSS custom property overrides.
// The three built-in themes (kowloon-light, kowloon-dark, system) are seeded on startup.

import mongoose from "mongoose";

const { Schema } = mongoose;

// Strict map of DaisyUI v5 color token names → CSS values (without the --color- prefix)
const ThemeColorsSchema = new Schema(
  {
    "base-100": String,
    "base-200": String,
    "base-300": String,
    "base-content": String,
    "primary": String,
    "primary-content": String,
    "secondary": String,
    "secondary-content": String,
    "accent": String,
    "accent-content": String,
    "neutral": String,
    "neutral-content": String,
    "info": String,
    "info-content": String,
    "success": String,
    "success-content": String,
    "warning": String,
    "warning-content": String,
    "error": String,
    "error-content": String,
  },
  { _id: false }
);

// Post type accent colors — injected as --post-color-* variables
const ThemePostColorsSchema = new Schema(
  {
    note: String,
    article: String,
    media: String,
    link: String,
    event: String,
  },
  { _id: false }
);

const ThemeSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    author: { type: String, default: "system" },
    version: { type: String, default: "1.0.0" },

    // "light" | "dark" | "system" (system = follow OS prefers-color-scheme)
    colorScheme: {
      type: String,
      enum: ["light", "dark", "system"],
      required: true,
    },

    // true for kowloon-light, kowloon-dark, system — cannot be deleted via API
    isBuiltIn: { type: Boolean, default: false },

    // null for the "system" theme (no override needed)
    colors: { type: ThemeColorsSchema, default: null },
    postColors: { type: ThemePostColorsSchema, default: null },

    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  {
    collection: "themes",
    timestamps: false,
  }
);

ThemeSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Theme = mongoose.model("Theme", ThemeSchema);
export default Theme;
