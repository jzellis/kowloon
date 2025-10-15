// /routes/middleware/attachUser.js
import jwt from "jsonwebtoken";
import getSettings from "#methods/settings/get.js";
import { User } from "#schema";

let cached; // only memoize when we *actually* have a key

function normalizePem(s) {
  // allow env keys like "-----BEGIN...\\n...\\n-----END..."
  return typeof s === "string" ? s.replace(/\\n/g, "\n").trim() : s;
}

async function getVerifyConfig() {
  // 1) Env override (handy in dev/pm2)
  const envPub = normalizePem(process.env.JWT_PUBLIC_KEY);
  const envIssuer =
    process.env.JWT_ISSUER ||
    (process.env.KOWLOON_DOMAIN
      ? `https://${process.env.KOWLOON_DOMAIN}`
      : undefined);

  if (envPub && envIssuer) {
    cached = { publicKey: envPub, issuer: envIssuer };
    return cached;
  }

  // 2) Settings fallback
  if (!cached) {
    const s = await getSettings(); // should contain .publicKey
    const pub = normalizePem(s?.publicKey);
    const issuer = envIssuer || `https://${process.env.KOWLOON_DOMAIN}`;
    if (!pub) {
      // don't cache empties; let a subsequent call retry after settings are populated
      throw new Error("Missing JWT public key (settings.publicKey not set)");
    }
    cached = { publicKey: pub, issuer };
  }
  return cached;
}

export default async function attachUser(req, _res, next) {
  try {
    const auth = req.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return next();

    const token = auth.slice(7);
    const { publicKey, issuer } = await getVerifyConfig();

    const payload = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer, // must match signer
    });

    const userId = payload?.user?.id; // your signer embeds { user: { id, ... } }
    if (userId) {
      const user = await User.findOne({ id: userId })
        .select("id username")
        .lean(false);
      if (user) req.user = user;
    }
  } catch (e) {
    console.warn("attachUser: ignoring token:", e.message);
  }
  return next();
}
