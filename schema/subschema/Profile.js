import mongoose from "mongoose";
import GeoPointSchema from "./GeoPoint.js";
const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String },
    subtitle: { type: String },
    description: { type: String },
    urls: { type: [String], default: [] }, // array of URLs
    pronouns: { type: String },
    icon: { type: String }, // File ID or URL for backwards compatibility
    location: { type: GeoPointSchema }, // GeoJSON Point or undefined
  },
  { _id: false }
);

ProfileSchema.index(
  { location: "2dsphere" },
  {
    name: "profile_location_2dsphere",
    partialFilterExpression: { location: { $exists: true } },
  }
);

export default ProfileSchema;
