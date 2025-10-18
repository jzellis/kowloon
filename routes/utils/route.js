// /routes/utils/route.js
const DEV =
  process.env.NODE_ENV === "development" ||
  /^(1|true|yes)$/i.test(process.env.ROUTE_DEBUG || "");

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function isCreateUserActivity(body) {
  if (!isObj(body)) return false;
  if (body.type !== "Create") return false;
  if (body.objectType === "User") return true;
  const ot = body?.object?.type;
  return typeof ot === "string" && /^(User|Person)$/i.test(ot);
}

// ---- token helpers ----------------------------------------------------------
function findToken(req) {
  const hdrs = req.headers || {};
  const auth = hdrs.authorization || hdrs.Authorization || "";
  // Accept "Bearer <t>", "Token <t>", "JWT <t>", or raw "<t>"
  let m = auth.match(/^(?:Bearer|Token|JWT)\s+(.+)$/i);
  if (m && m[1]) return m[1].trim();
  if (auth && !/\s/.test(auth)) return auth.trim();
  // common alt headers (just in case)
  const alt =
    hdrs["x-auth-token"] ||
    hdrs["x-access-token"] ||
    hdrs["x-token"] ||
    hdrs["auth-token"] ||
    hdrs["x-jwt"];
  if (alt) return String(alt).trim();
  return "";
}

async function attachUserFromToken(req) {
  if (req.user && req.user.id) return true;

  const rawAuth =
    req.headers?.authorization || req.headers?.Authorization || "";
  const token = findToken(req);

  if (DEV) {
    console.log(`ROUTE auth: Authorization header: ${rawAuth || "(none)"}`);
    console.log(`ROUTE auth: extracted token: ${token || "(none)"}`);
  }
  if (!token) return false;

  // Primary: use your project's RS256 verifier (jose)
  try {
    const mod = await import("#methods/auth/verifyUserJwt.js");
    const verifyUserJwt = mod?.default || mod;
    const expectedIssuer = `https://${
      process.env.KOWLOON_DOMAIN || process.env.DOMAIN
    }`;
    const payload = await verifyUserJwt(token, {
      expectedIssuer,
      expectedAudience: undefined,
    });
    const id =
      payload?.user?.id || payload?.id || payload?.sub || payload?.actorId;

    if (id) {
      req.user = payload.user ? payload.user : { id };
      if (DEV)
        console.log(`ROUTE auth: attached via verifyUserJwt → ${req.user.id}`);
      return true;
    }
  } catch (e) {
    if (DEV)
      console.warn(`ROUTE auth: verifyUserJwt failed: ${e?.message || e}`);
  }

  // Dev-only fallback: decode without verifying so you can see what's inside
  if (DEV) {
    try {
      const jwt = await import("jsonwebtoken");
      if (jwt?.decode) {
        const payload = jwt.decode(token);
        const id =
          payload?.user?.id || payload?.id || payload?.sub || payload?.actorId;
        if (id) {
          req.user = payload.user ? payload.user : { id };
          console.log(
            `ROUTE auth: attached via jwt.decode (DEV) → ${req.user.id}`
          );
          return true;
        }
      }
    } catch {}
  }

  if (DEV) console.log("ROUTE auth: could not attach user from token");
  return false;
}

// ---- wrapper ---------------------------------------------------------------
export default function route(handler, options = {}) {
  const {
    allowUnauth = false,
    allowUnauthCreateUser = false,
    label = "ROUTE",
  } = options;

  return async function routeWrapper(req, res) {
    const rid = Math.random().toString(36).slice(2, 8);
    const tag = `${label} ${rid}`;

    const method = req?.method || "GET";
    const path = req?.originalUrl || req?.url || "";
    const ip = req?.ip || req?.connection?.remoteAddress || "";
    const body = req.body ?? {};

    // Attach req.user BEFORE the auth gate
    await attachUserFromToken(req);
    const user = req.user ?? null;

    const allow =
      allowUnauth || (allowUnauthCreateUser && isCreateUserActivity(body));

    if (DEV) {
      console.log(`${tag}: enter`, {
        method,
        path,
        ip,
        user: user?.id || null,
        allowUnauth: allow,
      });
      if (Object.keys(body || {}).length) console.log(`${tag}: body`, body);
    }

    if (!user?.id && !allow) {
      if (DEV) console.warn(`${tag}: 401 Unauthorized (no req.user)`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const out = {};
    const set = (k, v) => {
      out[k] = v;
    };
    const setStatus = (code) => {
      try {
        res.status(code);
      } catch {}
    };

    try {
      await handler({ req, body, user, set, setStatus });
      if (!res.statusCode || res.statusCode < 100) res.status(200);
      if (DEV) console.log(`${tag}: exit ${res.statusCode}`);
      res.json(out);
    } catch (err) {
      const msg = err?.message || String(err);
      if (DEV) console.error(`${tag}: handler threw`, err?.stack || msg);
      res.status(500).json({ error: msg });
    }
  };
}
