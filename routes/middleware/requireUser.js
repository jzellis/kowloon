// routes/middleware/requireUser.js
import verifyUserJwt from "#methods/auth/verifyUserJwt.js";

function toSafeUser(u) {
  if (!u) return null;
  const { id, username, profile, roles, scopes } = u;
  return { id, username, profile, roles, scopes };
}

/**
 * Strict auth: requires a valid Bearer user token; 401 otherwise.
 */
export default function requireUser({ expectedAudience } = {}) {
  return async (req, res, next) => {
    try {
      const authz = req.header("Authorization") || "";
      if (!authz.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing Bearer token" });
      }
      const token = authz.slice(7).trim();
      const payload = await verifyUserJwt(token, {
        expectedAudience: expectedAudience || `https://${process.env.DOMAIN}`,
      });
      const safe = toSafeUser(payload?.user);
      if (!safe?.id) {
        return res.status(401).json({ error: "Invalid user token" });
      }
      req.user = safe;
      res.locals.user = safe;
      next();
    } catch (e) {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
