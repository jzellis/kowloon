// /routes/register/index.js
// Public registration endpoint (no auth).
// POST /register
// Body: { username, password, email?, profile?, ... }
// Response (JSON): { user, token }

import express from "express";
import { SignJWT, importPKCS8 } from "jose";
import route from "#routes/utils/route.js";
import getSettings from "#methods/settings/get.js";
import { User, Invite } from "#schema";
import { strictRateLimiter } from "../middleware/rateLimiter.js";

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;

const PETTY_LIMITS = [
  { normalized: "ghostmountain", max: 43 },
];

function normalizeUsername(username) {
  return username.toLowerCase().replace(/[^a-z]/g, "");
}

async function checkUsernameLimit(username) {
  const normalized = normalizeUsername(username);
  for (const rule of PETTY_LIMITS) {
    if (normalized.includes(rule.normalized) || rule.normalized.includes(normalized)) {
      const regex = new RegExp(rule.normalized.split("").join("[^a-z]*"), "i");
      const count = await User.countDocuments({ username: { $regex: regex } });
      if (count >= rule.max) {
        return { allowed: false, reason: "Username unavailable" };
      }
    }
  }
  return { allowed: true };
}

function pickUserInput(body = {}) {
  // Only pick fields your schema expects to ingest directly.
  // Pre-save hook in User.js will fill id, actorId, keys, circles, etc.
  return {
    username: isNonEmpty(body.username) ? body.username.trim() : null,
    password: isNonEmpty(body.password) ? body.password : null,
    email: isNonEmpty(body.email) ? body.email.trim() : undefined,
    profile: isObj(body.profile) ? body.profile : undefined,
    to: isNonEmpty(body.to) ? body.to : undefined,
    canReply: isNonEmpty(body.canReply) ? body.canReply : undefined,
    canReact: isNonEmpty(body.canReact) ? body.canReact : undefined,
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
    following: doc.circles?.following || null,
    allFollowing: doc.circles?.allFollowing || null,
    blocked: doc.circles?.blocked || null,
    muted: doc.circles?.muted || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const registerHandler = route(
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
    const registrationIsOpen = settings.registrationIsOpen !== false;
    const inviteCode = isNonEmpty(body.inviteCode) ? body.inviteCode.trim() : null;

    // If registration is closed, require an invite code
    let invite = null;
    if (!registrationIsOpen) {
      if (!inviteCode) {
        setStatus(403);
        return { error: "Registration is invite-only. Please provide an invite code." };
      }

      // Find and validate the invite
      invite = await Invite.findOne({
        code: inviteCode,
        active: true,
        deletedAt: null,
      });

      if (!invite) {
        setStatus(404);
        return { error: "Invalid invite code" };
      }

      if (!invite.isValid) {
        // Determine specific reason
        let reason = "Invite is no longer valid";
        if (invite.expiresAt && new Date() > invite.expiresAt) {
          reason = "Invite has expired";
        } else if (invite.type === "individual" && invite.usedAt) {
          reason = "Invite has already been used";
        } else if (
          invite.type === "open" &&
          invite.maxRedemptions !== null &&
          invite.redemptionCount >= invite.maxRedemptions
        ) {
          reason = "Invite has reached its redemption limit";
        }
        setStatus(410);
        return { error: reason };
      }
    }

    const input = pickUserInput(body);

    // For individual invites, verify email matches
    if (invite && invite.type === "individual") {
      if (!isNonEmpty(input.email)) {
        setStatus(400);
        return { error: "Email is required for this invite" };
      }
      if (input.email.toLowerCase() !== invite.email.toLowerCase()) {
        setStatus(403);
        return { error: "This invite is for a different email address" };
      }
    }

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

    const limitCheck = await checkUsernameLimit(input.username);
    if (!limitCheck.allowed) {
      setStatus(409);
      return { error: limitCheck.reason };
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
      to: input.to,
      canReply: input.canReply,
      canReact: input.canReact,
    });

    // Redeem the invite if one was used
    if (invite) {
      try {
        await invite.redeem(created.id, input.email);
      } catch (err) {
        // Log but don't fail registration - user is already created
        console.error("Failed to redeem invite after registration:", err.message);
      }
    }

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
    const pk = await importPKCS8(privateKey.replace(/\\n/g, "\n").trim(), "RS256");
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(issuer)
      .setExpirationTime("365d")
      .sign(pk);

    const user = sanitizeUser(created);

    // Useful headers for tests/clients
    setStatus(201);
    set("user", user);
    set("token", token);

    return { user, token };
  },
  {
    // Allow unauthenticated POST for registration
    allowUnauth: true,
    label: "REGISTER",
  }
);

const router = express.Router({ mergeParams: true });
router.use(strictRateLimiter);
router.post("/", registerHandler);
export default router;
