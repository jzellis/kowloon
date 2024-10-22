import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
import Settings from "./Settings.js";
import Circle from "./Circle.js";
import jwt from "jsonwebtoken";

const UserSchema = new Schema(
  {
    id: { type: String, key: true },
    username: { type: String, default: undefined, unique: true },
    password: { type: String, default: undefined },
    email: { type: String, default: undefined },
    profile: {
      type: Object,
      default: {
        name: { type: String, default: undefined },
        bio: { type: String, default: undefined },
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
        defaultPostAudience: "@_public",
        defaultPostReplyAudience: "",
        defaultPostView: "",
        defaultCircleView: "",
      },
    },
    following: { type: [Object], default: [] },
    followers: { type: [Object], default: [] },
    blocked: { type: [String], default: [] },
    muted: { type: [String], default: [] },
    lastLogin: Date,
    keys: {
      public: String,
      private: String,
    },
    url: { type: String, default: undefined },
    isAdmin: { type: Boolean, default: false },
    accessToken: String,
    active: { type: Boolean, default: true },
    flagged: { type: Boolean, default: false },
    deletedAt: { type: Date, default: undefined },
    lastLogin: Date,
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true }, timestamps: true }
);

UserSchema.index({
  username: "text",
  email: "text",
  "profile.name": "text",
  "profile.bio": "text",
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
    this.url = this.url || `https://${domain}/users/${this.username}`;

    this.accessToken = jwt.sign(
      {
        username: this.username,
        _id: this._id,
      },
      process.env.JWT_KEY
    );
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048, // Adjust the key length as per your requirements
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    this.keys.public = publicKey;
    this.keys.private = privateKey;

    await Circle.create({
      name: `${this.username} - Following`,
      actorId: this.id,
      description: `${this.profile.name} (@${this.username}) | Following`,
    });

    if (!this.profile.pronouns) {
      this.profile.pronouns = (
        await Settings.findOne({
          name: "defaultPronouns",
        })
      ).value;
    }
  }
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

const User = mongoose.model("User", UserSchema);

export default User;
