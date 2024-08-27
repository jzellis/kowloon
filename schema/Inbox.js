import mongoose from "mongoose";
const Schema = mongoose.Schema;

const InboxSchema = new Schema(
  {
    id: { type: [String], required: true },
    to: { type: [String], required: true },
    item: { type: Object, required: true },
    read: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "inbox",
  }
);

export default mongoose.model("Inbox", InboxSchema);
