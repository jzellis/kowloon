// /schema/SignatureNonce.js
// Tracks HTTP signature nonces to prevent replay attacks
import mongoose from "mongoose";

const { Schema } = mongoose;

const SignatureNonceSchema = new Schema(
  {
    signatureHash: { type: String, required: true, unique: true },
    keyId: { type: String, required: true },
    requestTarget: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 }, // TTL index - automatic cleanup
  },
  { timestamps: true }
);

export default mongoose.model("SignatureNonce", SignatureNonceSchema);
