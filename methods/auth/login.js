// /methods/auth/login.js
import { User } from "#schema";
import generateToken from "#methods/generate/token.js";

const S = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

export default async function login(input, maybePassword = "") {
  // Accept either style:
  //   login({ username, actorId: id, password })
  //   login(username, password)
  const hasObj = input && typeof input === "object";
  const username = hasObj ? S(input.username).trim() : S(input).trim();
  const actorId = hasObj ? S(input.actorId || input.id).trim() : "";
  const password = hasObj ? S(input.password) : S(maybePassword); // do NOT trim pw

  if ((!username && !actorId) || !password) {
    return { error: "Missing parameter" };
  }

  // Look up by actor id (id) OR username
  const query = actorId ? { id: actorId } : { username };
  const userDoc = await User.findOne(query)
    .select("id username type profile prefs publicKey password lastLogin")
    .lean(false); // need a Mongoose doc to call instance methods

  if (!userDoc) return { error: "Invalid credentials" };

  const ok = await userDoc.verifyPassword(password); // bcrypt compare via schema method
  if (!ok) return { error: "Invalid credentials" };

  // (optional) best-effort lastLogin update
  try {
    await User.updateOne(
      { _id: userDoc._id },
      { $set: { lastLogin: new Date() } }
    );
  } catch {}

  const token = await generateToken(userDoc.id);

  // Safe user payload
  const uo = userDoc.toObject({ depopulate: true });
  const user = {
    id: uo.id,
    username: uo.username,
    type: uo.type,
    profile: uo.profile,
    prefs: uo.prefs,
    publicKey: uo.publicKey,
  };

  return { user, token };
}
