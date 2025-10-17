// /methods/auth/login.js
// Defensive input normalization so .trim() never throws.
//
// Accepts: { actorId?, username?, password? | pass? }
// Returns whatever your existing logic returns (token/user/etc.)

const safeStr = (v) => {
  if (typeof v === "string") return v;
  if (v == null) return "";
  try {
    return String(v);
  } catch {
    return "";
  }
};

export default async function login(input = {}) {
  // Normalize inputs to strings BEFORE any trim or validation
  const rawActorId = safeStr(input.actorId);
  const rawUsername = safeStr(input.username);
  const rawPw = safeStr(input.password ?? input.pass);

  const actorId = rawActorId.trim();
  const username = rawUsername.trim();
  const password = rawPw; // don't trim passwords; treat them literally

  // Minimal validation (adjust messages to your taste)
  if (!username && !actorId) {
    throw new Error("username or actorId required");
  }
  if (!password) {
    throw new Error("password required");
  }

  // --- Your existing lookup/auth logic goes here ---
  // Example sketch (replace with your real code):
  //
  // const user = username
  //   ? await Users.findByUsername(username)
  //   : await Users.findByActorId(actorId);
  //
  // if (!user) throw new Error("Invalid credentials");
  // const ok = await Auth.verifyPassword(user, password);
  // if (!ok) throw new Error("Invalid credentials");
  //
  // const token = await Auth.issueToken(user);
  // return { token, user };

  throw new Error(
    "login() not wired: implement your existing lookup + token issuance here"
  );
}
