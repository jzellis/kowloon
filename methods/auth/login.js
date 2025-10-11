// #methods/auth/login.js
import getSettings from "#methods/settings/get.js";
import { User } from "#schema";
import generateToken from "#methods/generate/token.js";

/**
 * Login with username or Kowloon user id.
 * Returns: { user, token } on success, or { error: "Invalid credentials" }.
 */
export default async function login(username, password = "") {
  const raw = (username || "").trim();
  const pass = typeof password === "string" ? password : "";

  if (!raw || !pass) {
    return { error: "Invalid credentials" };
  }

  // choose lookup field: "@user@domain" => id, else username
  const lookup = raw.startsWith("@") ? { id: raw } : { username: raw };

  // Pull exactly what we need for verify + response (password included for verify)
  // If your schema has password with select:false, use +password to include it.
  const userDoc = await User.findOne(lookup)
    .select("+password id username type profile prefs publicKey lastLogin") // include password for verify
    .lean(false); // need a Mongoose doc to call instance methods like verifyPassword

  // Generic error to avoid user enumeration
  if (!userDoc) {
    // Optional: perform a dummy hash here to equalize timing
    return { error: "Invalid credentials" };
  }

  const ok = await userDoc.verifyPassword(pass);
  if (!ok) {
    // No specific logs; keep responses uniform
    return { error: "Invalid credentials" };
  }

  // Fire-and-forget style update for last login (no version bump)
  // If this throws, don't block login response.
  try {
    await User.updateOne(
      { _id: userDoc._id },
      { $set: { lastLogin: new Date() } }
    );
  } catch {}

  // Create JWT tied to the user id (your generateToken handles signing)
  const token = await generateToken(userDoc.id);

  // Build safe user payload without password/private fields
  const u = userDoc.toObject({ depopulate: true });
  delete u._id;
  delete u.__v;
  delete u.password;

  // Return minimal + useful profile (add/remove fields as you prefer)
  const user = {
    id: u.id,
    username: u.username,
    type: u.type,
    profile: u.profile,
    prefs: u.prefs,
    publicKey: u.publicKey,
  };

  return { user, token };
}
