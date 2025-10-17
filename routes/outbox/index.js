import express from "express";
import post from "./post.js";

const router = express.Router({ mergeParams: true });

// Parse JSON right here so body is available to the gate
const JSON_LIMIT = process.env.JSON_LIMIT || "2mb";
const jsonTypes = [
  "application/json",
  "application/activity+json",
  "application/ld+json",
  "text/json",
  "text/activity+json",
];
router.use(
  express.json({
    limit: JSON_LIMIT,
    type: (req) => {
      const ct = (req.headers["content-type"] || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!ct) return false;
      if (jsonTypes.includes(ct)) return true;
      if (ct.endsWith("+json")) return true;
      return false;
    },
  })
);

const DEV =
  process.env.NODE_ENV === "development" ||
  /^(1|true|yes)$/i.test(process.env.ROUTE_DEBUG || "") ||
  /^(1|true|yes)$/i.test(process.env.OUTBOX_DEBUG || "");

// Optional auth middleware (if your project has one)
let requireAuth = (req, _res, next) => next();
try {
  const mod = await import("../middleware/auth.js"); // ok even if missing
  const m = mod?.default || mod?.requireAuth || mod;
  if (typeof m === "function") requireAuth = m;
} catch {
  /* no auth middleware present; proceed */
}

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function isCreateUser(body) {
  if (!isObj(body)) return false;
  if (body.type !== "Create") return false;
  if (body.objectType === "User") return true;
  const ot = body?.object?.type;
  return typeof ot === "string" && /^(User|Person)$/i.test(ot);
}

// Gate: allow unauth ONLY for Create→User; otherwise require auth
function authGate(req, res, next) {
  const allow = req.method === "POST" && isCreateUser(req.body);
  if (allow) {
    if (DEV) console.log("OUTBOX authGate: bypass auth for Create→User");
    return next();
  }
  return requireAuth(req, res, next);
}

// Mount the POST handler
router.post("/", authGate, post);

export default router;
