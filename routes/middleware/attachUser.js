// routes/middleware/attachUser.js
import verifyUserJwt from "#methods/auth/verifyUserJwt.js";

// minimal 'shape' we expose to routes -- no secrets
function toSafeUser(payloadUser) {
  if (!payloadUser) return null;
  const { id, username, profile, roles, scopes } = payloadUser;
  return { id, username, profile, roles, scopes };
}

/**
 * Optional auth: if Authorization: Bearer <jwt> is present and valid,
 * attaches req.user (sanitized). Otherwise leaves req.user undefined.
 */
export default function attachUserOptional({ expectedAudience } = {}) {
  return async (req, res, next) => {
    try {
      const authz = req.header("Authorization") || "";
      if (!authz.startsWith("Bearer ")) return next();

      const token = authz.slice(7).trim();

      // If your tokens include "iss", let verifyUserJwt pick JWKS vs local automatically.
      const payload = await verifyUserJwt(token, {
        expectedAudience: expectedAudience || `https://${process.env.DOMAIN}`,
        // expectedIssuer:  // optional: pass if you want to pin issuer
      });

      req.user = toSafeUser(payload?.user) || undefined;
      res.locals.user = req.user; // handy for view layers / downstream
    } catch {
      // Don't block public routes on bad token; just proceed unauthenticated.
      // If you want to be stricter, log here.
    }
    next();
  };
}
