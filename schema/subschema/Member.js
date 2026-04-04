// schema/subschema/Member.js
// Circle/Group member — Actor fields plus federation freshness tracking.

import mongoose from "mongoose";
import ActorSchema from "./Actor.js";
const { Schema } = mongoose;

const MemberSchema = new Schema(
  {
    ...ActorSchema.obj,
    lastFetchedAt: { type: Date, default: null },
  },
  { _id: false, timestamps: true }
);

export default MemberSchema;
