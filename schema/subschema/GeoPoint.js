import mongoose from "mongoose";

export default new mongoose.Schema(
  {
    name: { type: String },
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true,
    },
    // IMPORTANT: [longitude, latitude]
    coordinates: {
      type: [Number],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.length === 2 &&
          arr.every((n) => Number.isFinite(n)) &&
          arr[0] >= -180 &&
          arr[0] <= 180 &&
          arr[1] >= -90 &&
          arr[1] <= 90,
        message: "coordinates must be [lng, lat]",
      },
      required: true,
    },
  },
  { _id: false }
);
