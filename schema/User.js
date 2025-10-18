import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
import GeoPointSchema from "./subschema/GeoPoint.js";
import ProfileSchema from "./subschema/Profile.js";
import { Settings, Circle, Group } from "./index.js";

const UserSchemaDef = {
  // Existing fields
  id: { type: String, unique: true }, // e.g., @alice@kwln.org (your current format--kept for compatibility)
  server: { type: String },
  objectType: { type: String, default: "User" },
  type: { type: String, default: "Person" },

  // AS/AP alias: preferredUsername <-> username
  username: {
    type: String,
    unique: true,
    required: true,
    alias: "preferredUsername",
  },

  password: { type: String },
  email: { type: String, unique: true, sparse: true },
  profile: { type: ProfileSchema, default: {} },

  // Preferences (unchanged)
  prefs: {
    defaultPostType: { type: String, default: "Note" },
    defaultTo: { type: String, default: "@public" },
    defaultReplyTo: { type: String, default: "@public" },
    defaultReactTo: { type: String, default: "@public" },
    defaultPostView: {
      type: [String],
      default: ["Note", "Article", "Media", "Link"],
    },
    defaultCircleView: { type: String, default: "" },
    defaultEditorType: { type: String, default: "html" },
    lang: { type: String, default: "en" },
    theme: { type: String, default: "light" },
  },

  // ActivityPub endpoints (+ aliases)
  inbox: { type: String, alias: "inboxUrl" },
  outbox: { type: String, alias: "outboxUrl" },

  following: { type: String, default: "" },
  allFollowing: { type: String, default: "" },
  blocked: { type: String, default: "" },
  muted: { type: String, default: "" },

  lastLogin: { type: Date },

  // Keys
  publicKey: { type: String, alias: "publicKeyPem" }, // PEM (your current)
  privateKey: { type: String, alias: "privateKeyPem" }, // PEM (your current)
  publicKeyJwk: { type: Schema.Types.Mixed }, // NEW: structured JWK for interop
  keyRotationAt: { type: Date }, // NEW: track rotations

  // Addressing defaults (unchanged)
  to: { type: String, default: "" },
  replyTo: { type: String, default: "" },
  reactTo: { type: String, default: "" },

  // Actor/web metadata
  url: { type: String }, // your existing profile URL
  active: { type: Boolean, default: true },
  deletedAt: { type: Date },
  feedRefreshedAt: { type: Date },

  // NEW: federation helpers
  domain: { type: String }, // e.g., kwln.org
  jwksUrl: { type: String }, // e.g., https://kwln.org/.well-known/jwks.json
  actorId: { type: String, unique: true, sparse: true }, // canonical AS `id` (URL), optional for migration
};

// Meta
const MetaSchema = new mongoose.Schema(
  {
    seed: { type: String },
    runId: { type: String, index: true },
    externalId: { type: String },
  },
  { _id: false }
);
UserSchemaDef.meta = { type: MetaSchema };

const UserSchema = new mongoose.Schema(UserSchemaDef, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true,
});

/** ---------- Text & dev indexes ---------- */
UserSchema.index({
  username: "text",
  email: "text",
  "profile.name": "text",
  "profile.description": "text",
  "profile.location.name": "text",
});
if (process.env.NODE_ENV === "development") {
  UserSchema.index({ "meta.seed": 1 });
  UserSchema.index({ "meta.externalId": 1 }, { unique: true, sparse: true });
}

// ---------- Virtuals: Circles ----------
UserSchema.virtual("ownedCircles", {
  ref: "Circle",
  localField: "id", // user.id like "@alice@kwln.org"
  foreignField: "actorId", // circles the user owns (Following, Blocked, etc.)
  justOne: false,
});

UserSchema.virtual("memberCircles", {
  ref: "Circle",
  localField: "id",
  foreignField: "members.id", // circles where user is in members[]
  justOne: false,
});

/** ---------- ActivityStreams-friendly virtuals ---------- */
// name <-> profile.name
UserSchema.virtual("name")
  .get(function () {
    return this.profile?.name;
  })
  .set(function (v) {
    this.profile = this.profile || {};
    this.profile.name = v;
  });

// summary <-> profile.description
UserSchema.virtual("summary")
  .get(function () {
    return this.profile?.description;
  })
  .set(function (v) {
    this.profile = this.profile || {};
    this.profile.description = v;
  });

// icon <-> profile.icon
UserSchema.virtual("icon")
  .get(function () {
    return this.profile?.icon;
  })
  .set(function (v) {
    this.profile = this.profile || {};
    this.profile.icon = v;
  });

/** ---------- Hooks ---------- */
UserSchema.pre("save", async function (next) {
  const domainSetting = await Settings.findOne({ name: "domain" });
  const domain = domainSetting?.value;
  if (!domain) return next(new Error("Missing Settings: domain"));
  if (this.isModified("password"))
    this.password = bcrypt.hashSync(this.password, 10);

  if (this.isNew) {
    // Keep your existing id scheme for compatibility
    this.id = this.id || `@${this.username}@${domain}`;

    // NEW: set canonical actorId (URL) for AS/AP without breaking your current id
    this.actorId = this.actorId || `https://${domain}/users/${this.username}`;

    // Profile defaults
    this.profile = this.profile || {};
    this.profile.icon =
      this.profile.icon || `https://${domain}/images/user.png`;

    // Keep your existing url behavior
    this.url = this.url || `https://${domain}/users/${this.id}`;

    // Server / JWKS
    this.server =
      this.server || (await Settings.findOne({ name: "actorId" }))?.value;
    this.domain = this.domain || domain;
    this.jwksUrl = this.jwksUrl || `https://${domain}/.well-known/jwks.json`;

    // Keys (PEM for now). Optionally also populate publicKeyJwk if you like.
    if (!this.publicKey || !this.privateKey) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      this.publicKey = publicKey;
      this.privateKey = privateKey;
      this.keyRotationAt = new Date();
    }

    // Endpoints
    if (!this.inbox)
      this.inbox = `https://${domain}/users/${this.username}/inbox`;
    if (!this.outbox)
      this.outbox = `https://${domain}/users/${this.username}/outbox`;

    // System circles
    const selfMember = {
      id: this.id,
      serverId: this.server,
      type: "kowloon",
      name: this.profile.name,
      inbox: this.inbox,
      outbox: this.outbox,
      icon: this.profile.icon,
      url: this.url,
    };

    const followingCircle = await Circle.create({
      name: `${this.id} | Following`,
      actorId: this.id,
      description: `${this.profile.name} (@${this.username}) | Following`,
      to: this.id,
      replyTo: this.id,
      reactTo: this.id,
      members: [selfMember],
    });
    this.following = followingCircle.id;

    const allFollowingCircle = await Circle.create({
      name: `${this.id} | All Following`,
      actorId: this.id,
      description: `${this.profile.name} (@${this.username}) | All Following`,
      to: this.id,
      replyTo: this.id,
      reactTo: this.id,
      members: [selfMember],
    });
    this.allFollowing = allFollowingCircle.id;

    const blockedCircle = await Circle.create({
      name: `${this.id} | Blocked`,
      actorId: this.id,
      description: `${this.profile.name} (@${this.username}) | Blocked`,
      to: this.id,
      replyTo: this.id,
      reactTo: this.id,
    });
    this.blocked = blockedCircle.id;

    const mutedCircle = await Circle.create({
      name: `${this.id} | Muted`,
      actorId: this.id,
      description: `${this.profile.name} (@${this.username}) | Muted`,
      to: this.id,
      replyTo: this.id,
      reactTo: this.id,
    });
    this.muted = mutedCircle.id;

    if (!this.profile.pronouns) {
      const pronouns = await Settings.findOne({ name: "defaultPronouns" });
      this.profile.pronouns = pronouns?.value;
    }
  }

  next();
});

/** ---------- Methods (unchanged) ---------- */
UserSchema.methods.verifyPassword = async function (plaintext) {
  return await bcrypt.compare(plaintext, this.password);
};

UserSchema.methods.getMemberships = async function () {
  const circles = (
    await Circle.find({
      $or: [{ "members.id": this.id }, { actorId: this.id }],
    }).lean()
  ).map((c) => c.id);

  const groups = (
    await Group.find({
      $or: [
        { "members.id": this.id },
        { actorId: this.id },
        { admins: this.id },
      ],
    }).lean()
  ).map((g) => g.id);

  return [...circles, ...groups];
};

UserSchema.methods.getBlocked = async function () {
  return (await Circle.findOne({ id: this.blocked })).members.map((m) => m.id);
};

UserSchema.methods.getMuted = async function () {
  return (await Circle.findOne({ id: this.muted })).members.map((m) => m.id);
};

UserSchema.methods.createUserSignature = function (timestamp) {
  const token = this.id + ":" + timestamp.toString();
  const hash = crypto.createHash("sha256").update(token).digest();
  const signature = crypto
    .sign("sha256", hash, this.privateKey)
    .toString("base64");
  return { id: this.id, timestamp, signature };
};

UserSchema.methods.verifyUserSignature = function (timestamp, signature) {
  const token = this.id + ":" + timestamp;
  const hash = crypto.createHash("sha256").update(token).digest();
  const isValid = crypto.verify(
    "sha256",
    hash,
    this.publicKey,
    Buffer.from(signature, "base64")
  );
  return isValid ? isValid : new Error("User cannot be authenticated");
};

const User = mongoose.model("User", UserSchema);
export default User;
