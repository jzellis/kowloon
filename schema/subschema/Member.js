// schema/_subdocs/Member.js
import mongoose from "mongoose";
const { Schema } = mongoose;

// Base member fields used across Circle and Group.
const MemberSchema = new Schema(
  {
    id: { type: String, required: true }, // @user@domain
    name: { type: String },
    inbox: { type: String },
    outbox: { type: String },
    icon: { type: String },
    url: { type: String },
    server: { type: String }, // domain or server label
  },
  { _id: false, timestamps: true }
);

export default MemberSchema;
