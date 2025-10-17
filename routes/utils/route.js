// /routes/utils/route.js
const DEV =
  process.env.NODE_ENV === "development" ||
  /^(1|true|yes)$/i.test(process.env.ROUTE_DEBUG || "");

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const redact = (value, seen = new WeakSet()) => {
  const SENSITIVE = new Set([
    "password",
    "pass",
    "token",
    "authorization",
    "auth",
    "jwt",
    "accessToken",
  ]);
  if (!isObj(value)) return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  const out = Array.isArray(value) ? [] : {};
  for (const k of Object.keys(value)) {
    const v = value[k];
    out[k] = SENSITIVE.has(k) ? "[redacted]" : isObj(v) ? redact(v, seen) : v;
  }
  return out;
};
const safe = (v) => {
  try {
    return JSON.stringify(redact(v), null, 2);
  } catch {
    return "[unstringifiable]";
  }
};

function isCreateUserActivity(body) {
  if (!isObj(body)) return false;
  if (body.type !== "Create") return false;
  if (body.objectType === "User") return true;
  const ot = body?.object?.type;
  return typeof ot === "string" && /^(User|Person)$/i.test(ot);
}

/**
 * route(handler, options?)
 * options:
 *   - allowUnauth: boolean (default false)  <-- NEW
 *   - allowUnauthCreateUser: boolean (default false)
 *   - label: string for logs
 */
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
      if (Object.keys(body || {}).length) {
        console.log(`${tag}: body\n${safe(body)}`);
      }
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
