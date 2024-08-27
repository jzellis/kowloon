import mongoose from "mongoose";
const Schema = mongoose.Schema;

const OutboxSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "delivered", "error"],
      default: "pending",
    },
    actorId: { type: String, required: true },
    item: { type: Object, required: true },
    response: { type: Object, default: null },
    deliveredAt: { type: Date, default: null },
    error: { type: Object, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "outbox",
  }
);

export default mongoose.model("Outbox", OutboxSchema);
