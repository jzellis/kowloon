// /routes/register/index.js
// Public registration endpoint (no auth).
// POST /register
// Body: { username, password, email?, profile?, ... }
// Response (JSON): { user, token }

import jwt from "jsonwebtoken";
import route from "#routes/utils/route.js";
import getSettings from "#methods/settings/get.js";
import { User } from "#schema";

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;

function pickUserInput(body = {}) {
  // Only pick fields your schema expects to ingest directly.
  // Pre-save hook in User.js will fill id, actorId, keys, circles, etc.
  return {
    username: isNonEmpty(body.username) ? body.username.trim() : null,
    password: isNonEmpty(body.password) ? body.password : null,
    email: isNonEmpty(body.email) ? body.email.trim() : undefined,
    profile: isObj(body.profile) ? body.profile : undefined,
    // Add other safe fields as needed (prefs, etc.)
  };
}

function sanitizeUser(u) {
  if (!u) return null;
  const doc = u.toObject ? u.toObject() : u;
  return {
    id: doc.id, // @user@domain
    actorId: doc.actorId, // https://domain/users/username
    username: doc.username,
    email: doc.email || null,
    profile: doc.profile || {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export default route(
  async ({ body, set, setStatus }) => {
    if (!isObj(body)) {
      setStatus(400);
      return { error: "Invalid JSON body" };
    }

    const settings = await getSettings();
    const domain = settings?.domain;
    if (!isNonEmpty(domain)) {
      setStatus(500);
      return { error: "Missing settings.domain" };
    }

    // Optional: toggleable self-registration (defaults to enabled)
    const allowOpenRegistration = settings.allowOpenRegistration !== false;
    if (!allowOpenRegistration) {
      setStatus(403);
      return { error: "Registration disabled" };
    }

    const input = pickUserInput(body);

    if (!isNonEmpty(input.username)) {
      setStatus(400);
      return { error: "username is required" };
    }
    if (!isNonEmpty(input.password)) {
      setStatus(400);
      return { error: "password is required" };
    }

    // Compute the canonical id that your pre-save hook will set, so we can dupe-check.
    const expectedId = `@${input.username}@${domain}`;

    // Prevent duplicates by username or id
    const existing = await User.findOne({
      $or: [{ username: input.username }, { id: expectedId }],
    }).lean();
    if (existing) {
      setStatus(409);
      return { error: "User already exists" };
    }

    // Create; your User pre-save hook will:
    // - hash password if modified
    // - set id (@user@domain), actorId (URL), url, server/domain/jwksUrl
    // - generate RSA keypair if missing
    // - create following/allFollowing/blocked/muted circles
    const created = await User.create({
      username: input.username,
      password: input.password,
      email: input.email,
      profile: input.profile,
    });

    // Sign RS256 JWT shaped for routes/middleware/attachUser.js
    // attachUser expects payload.user.id to look up the user.
    const payload = {
      user: {
        id: created.id,
        username: created.username,
        actorId: created.actorId,
      },
    };

    // Prefer settings.privateKey (your project convention)
    const privateKey = settings.privateKey;
    if (!isNonEmpty(privateKey)) {
      setStatus(500);
      return { error: "Missing settings.privateKey" };
    }

    const issuer = `https://${domain}`;
    const token = jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      issuer,
      // You can tune this; keeping long-lived to match your one-time login preference
      expiresIn: "365d",
    });

    const user = sanitizeUser(created);

    // Useful headers for tests/clients
    setStatus(201);
    set("user", user);
    set("token", token);

    // return { user, token };
  },
  {
    // Allow unauthenticated POST for registration
    allowUnauth: true,
    label: "REGISTER",
  }
);
