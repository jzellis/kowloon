// schema/Flag.js
import mongoose from "mongoose";

const FlagSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true }, // "flag:<dbid>@host"
    target: { type: String, index: true, required: true }, // object id being flagged
    targetType: { type: String, index: true }, // "Post" | "Reply" | "Event" | ...
    targetActorId: { type: String }, // original author
    reason: { type: String, required: true }, // validated against Settings
    notes: { type: String }, // optional user-provided context
    actorId: { type: String, index: true, required: true }, // who flagged
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    createdAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    server: { type: String }, // our host
  },
  { minimize: true }
);

FlagSchema.pre("save", async function () {
  if (!this.id) {
    // match your id pattern: "flag:<dbid>@host"
    const host = this.server;
    const dbid = new mongoose.Types.ObjectId().toString().slice(-8);
    this.id = `flag:${dbid}@${host}`;
  }
});

export default mongoose.model("Flag", FlagSchema, "flags");
