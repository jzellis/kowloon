// schema/RecommendationSection.js
// A named shelf on the Discover screen (e.g. "Posts We Love"). Server-owned
// and server-signed, like a Page. Recommendations reference a section by its id.
//
// Sections are the organizing unit for Discover: the read endpoint returns
// active sections in `order`, each resolved to its visible recommendations.

import mongoose from "mongoose";
import { getServerSettings, getServerActor } from "#methods/settings/schemaHelpers.js";
import { signAs, verifyAs } from "#methods/utils/signing.js";

const { Schema } = mongoose;

function slugify(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const RecommendationSectionSchema = new Schema(
  {
    id: { type: String, unique: true, index: true },
    // Local domain on create; the source domain when hydrated from a remote server.
    originDomain: { type: String, default: () => getServerSettings()?.domain },
    objectType: { type: String, default: "RecommendationSection" },

    // Ownership — always the server actor (defaulted at construction so the
    // required check passes before the pre-save hook runs).
    actorId: {
      type: String,
      required: true,
      default: () => getServerSettings()?.actorId,
    },
    actor: { type: Object, default: undefined },
    server: { type: String, default: undefined },

    // Presentation
    name: { type: String, required: true }, // display title, e.g. "Posts We Love"
    slug: { type: String, default: undefined },
    summary: { type: String, default: undefined }, // optional shelf blurb

    order: { type: Number, default: 0 }, // shelf ordering on Discover
    active: { type: Boolean, default: true }, // hide without deleting

    // Section-level visibility. Usually @public; a @<domain> section is only
    // shown to authenticated local users.
    to: { type: String, default: "@public" },

    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },

    url: { type: String, default: undefined },
    signature: { type: Buffer, default: undefined },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

RecommendationSectionSchema.pre("save", async function (next) {
  try {
    const { domain, actorId } = getServerSettings();
    if (this.name) this.name = this.name.trim();
    if (!this.slug && this.name) this.slug = slugify(this.name);
    if (!this.id && domain) this.id = `section:${this._id}@${domain}`;
    if (!this.url && domain && this.id)
      this.url = `https://${domain}/recommendations/${this.slug || this.id}`;
    if (!this.actorId && actorId) this.actorId = actorId;
    if (!this.server && actorId) this.server = actorId;
    if (!this.actor) this.actor = getServerActor() || undefined;

    const sig = await signAs(this.actorId, `${this.id}|${this.name}|${this.to}`);
    if (sig) this.signature = sig;

    next();
  } catch (err) {
    next(err);
  }
});

RecommendationSectionSchema.methods.verifySignature = async function () {
  return verifyAs(this.actorId, `${this.id}|${this.name}|${this.to}`, this.signature);
};

export default mongoose.model(
  "RecommendationSection",
  RecommendationSectionSchema
);
