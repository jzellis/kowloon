// schema/subschema/Actor.js
// Canonical embedded actor reference — stored wherever an actor identity needs to be
// captured at write time (Post.actor, FeedItems.object.actor, etc.).
// Member.js extends this with federation-tracking fields.

import mongoose from "mongoose";
const { Schema } = mongoose;

const ActorSchema = new Schema(
  {
    id:     { type: String, required: true }, // @user@domain
    type:   { type: String, default: 'Person' }, // Person, Server, etc.
    name:   { type: String },                 // display name (profile.name)
    icon:   { type: String },                 // avatar URL
    url:    { type: String },                 // canonical profile URL
    inbox:  { type: String },
    outbox: { type: String },
    server: { type: String },                 // @domain
  },
  { _id: false }
);

export default ActorSchema;
