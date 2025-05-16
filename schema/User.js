import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
import { Settings, Circle, Group } from "./index.js";

const UserSchema = new Schema(
  {
    id: { type: String, key: true },
    objectType: { type: String, default: "User" },
    type: { type: String, default: "Person" },
    username: { type: String, default: undefined, unique: true },
    password: { type: String, default: undefined },
    email: { type: String, default: undefined },
    profile: {
      type: Object,
      default: {
        name: { type: String, default: undefined },
        subtitle: { type: String, default: undefined },
        description: { type: String, default: undefined },
        urls: { type: [Object], default: [] },
        pronouns: { type: Object, default: undefined },
        icon: { type: String, default: undefined },
        location: { type: Object, default: undefined },
      },
    },
    prefs: {
      type: Object,
      default: {
        defaultPostType: "Note",
        defaultTo: "@public",
        defaultReplyTo: "@public",
        defaultReactTo: "@public",
        defaultPostView: ["Note", "Article", "Media", "Link"],
        defaultCircleView: "",
        defaultEditorType: "html", // html or markdown
        lang: "en",
        theme: "light",
      },
    },
    inbox: { type: String },
    outbox: { type: String },
    following: { type: String, default: "" },
    // followers: { type: String, default: "" },
    blocked: { type: String, default: "" },
    muted: { type: String, default: "" },
    lastLogin: Date,
    publicKey: String,
    privateKey: String,
    to: { type: String, default: "" },
    replyTo: { type: String, default: "" },
    reactTo: { type: String, default: "" },
    url: { type: String, default: undefined },
    isAdmin: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    flaggedAt: { type: Date, default: null },
    flaggedBy: { type: String, default: null },
    flaggedReason: { type: String, default: null },
    deletedAt: { type: Date, default: undefined },
    lastLogin: Date,
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true }, timestamps: true }
);

UserSchema.index({
  username: "text",
  email: "text",
  "profile.name": "text",
  "profile.description": "text",
  "profile.location": "2dsphere",
  "location.name": "text",
});

UserSchema.virtual("circles", {
  ref: "Circle",
  localField: "actorId",
  foreignField: "id",
  justOne: false,
});

UserSchema.virtual("groups", {
  ref: "Group",
  localField: "members",
  foreignField: "id",
  justOne: false,
});

UserSchema.pre("save", async function (next) {
  let domain = (await Settings.findOne({ name: "domain" })).value;
  if (this.isModified("password"))
    this.password = bcrypt.hashSync(this.password, 10);

  if (this.isNew) {
    this.id = this.id || `@${this.username}@${domain}`;
    this.profile.icon = this.profile.icon || `//${domain}/images/user.png`;
    this.url = this.url || `https://${domain}/users/${this.id}`;

    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048, // Adjust the key length as per your requirements
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    this.publicKey = publicKey;
    this.privateKey = privateKey;

    let followingCircle = await Circle.create({
      name: `${this.id} | Following`,
      actorId: this.id,
      description: `${this.profile.name} (@${this.username}) | Following`,
      to: this.id,
      replyTo: this.id,
      reactTo: this.id,
    });
    this.following = followingCircle.id;
    let blockedCircle = await Circle.create({
      name: `${this.id} | Blocked`,
      actorId: this.id,
      description: `${this.profile.name} (@${this.username}) | Blocked`,
      to: this.id,
      replyTo: this.id,
      reactTo: this.id,
    });
    this.blocked = blockedCircle.id;
    let mutedCircle = await Circle.create({
      name: `${this.id} | Muted`,
      actorId: this.id,
      description: `${this.profile.name} (@${this.username}) | Muted`,
      to: this.id,
      replyTo: this.id,
      reactTo: this.id,
    });
    this.muted = mutedCircle.id;

    if (!this.profile.pronouns) {
      this.profile.pronouns = (
        await Settings.findOne({
          name: "defaultPronouns",
        })
      ).value;
    }
  }
  if (!this.inbox) this.inbox = `https://${domain}/users/${this.id}/inbox`;
  if (!this.outbox) this.outbox = `https://${domain}/users/${this.id}/outbox`;

  next();
});

UserSchema.pre("update", async function (next) {
  if (this.isModified("password"))
    this.password = bcrypt.hashSync(this.password, 10);
  next();
});

UserSchema.methods.verifyPassword = async function (plaintext) {
  return await bcrypt.compare(plaintext, this.password);
};

UserSchema.methods.getMemberships = async function () {
  let circles = (
    await Circle.find({ $or: [{ "members.id": id }, { actorId: id }] }).lean()
  ).map((c) => c.id);
  let groups = (
    await Group.find({
      $or: [{ "members.id": id }, { actorId: id }, { admins: id }],
    }).lean()
  ).map((g) => g.id);
  let memberships = [...circles, ...groups];
  return memberships;
};

UserSchema.methods.getBlocked = async function () {
  return (await Circle.findOne({ id: this.blocked })).members.map((m) => m.id);
};

UserSchema.methods.getMuted = async function () {
  return (await Circle.findOne({ id: this.muted })).members.map((m) => m.id);
};

UserSchema.methods.createUserSignature = function (timestamp) {
  let user = this;
  console.log(this);
  const token = user.id + ":" + timestamp.toString();
  const hash = crypto.createHash("sha256").update(token).digest();
  const signature = crypto
    .sign("sha256", hash, user.privateKey)
    .toString("base64");
  return { id: user.id, timestamp, signature };
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

UserSchema.methods.getMemberships = async function () {
  let circles = (
    await Circle.find({
      $or: [{ "members.id": this.id }, { actorId: this.id }],
    }).lean()
  ).map((c) => c.id);
  let groups = (
    await Group.find({
      $or: [
        { "members.id": this.id },
        { actorId: this.id },
        { admins: this.id },
      ],
    }).lean()
  ).map((g) => g.id);
  let memberships = [...circles, ...groups];
  return memberships;
};

const User = mongoose.model("User", UserSchema);

export default User;
