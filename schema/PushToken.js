// PushToken — a device's push registration for a user.
//
// `provider` tags HOW the token is delivered so we can swap the backend later
// without a flag day: "expo" goes through Expo's push service now; "native"
// (raw APNs/FCM device token) will go through our own push.kowloon.network
// gateway once it exists. Both can coexist during migration — sendPush routes
// each token to the right backend by its provider.

import mongoose from "mongoose";

const { Schema } = mongoose;

const PushTokenSchema = new Schema({
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true },
  provider: { type: String, enum: ["expo", "native"], default: "expo" },
  platform: { type: String, enum: ["ios", "android", "web"], default: "android" },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
});

export default mongoose.models.PushToken ||
  mongoose.model("PushToken", PushTokenSchema);
