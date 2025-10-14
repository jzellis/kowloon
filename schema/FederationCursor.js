// /schema/FederationCursor.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const FederationCursorSchema = new Schema(
  {
    viewerId: { type: String, required: true, index: true }, // local actor id (@me@my.dom)
    circleId: { type: String, required: true, index: true }, // local circle used for this sync
    remoteDomain: { type: String, required: true, index: true }, // e.g. example.org
    since: { type: String, default: null }, // opaque cursor or ISO timestamp
  },
  { timestamps: true }
);

// 1 cursor per (viewer, circle, remote)
FederationCursorSchema.index(
  { viewerId: 1, circleId: 1, remoteDomain: 1 },
  { unique: true }
);

export default mongoose.model("FederationCursor", FederationCursorSchema);
