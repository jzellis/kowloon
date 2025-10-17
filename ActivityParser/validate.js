// /ActivityParser/validate.js (ESM)

import { readdir, access } from "fs/promises";
import { constants } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HANDLERS_DIR = join(__dirname, "handlers");

let VERB_CACHE = null;

async function fileExists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function refreshVerbs() {
  VERB_CACHE = null;
  return getVerbs();
}

async function getVerbs() {
  if (VERB_CACHE) return VERB_CACHE;
  let entries = [];
  try {
    entries = await readdir(HANDLERS_DIR, { withFileTypes: true });
  } catch {
    /* empty */
  }
  const verbs = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const idx = join(HANDLERS_DIR, e.name, "index.js");
    if (await fileExists(idx)) verbs.push(e.name);
  }
  VERB_CACHE = new Set(verbs);
  return VERB_CACHE;
}

// ---- helpers ---------------------------------------------------------------

// From working validator:
function has(v) {
  return v !== undefined && v !== null;
}
// Keep isStr as "non-empty trimmed string"
function isStr(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function req(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Merge-in helper set from “validate new.js” (kept local; no external deps)
const nonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const isActorIdString = (s) =>
  nonEmpty(s) && s[0] === "@" && s.indexOf("@", 1) !== -1;
const isUrlLike = (s) => nonEmpty(s) && /^https?:\/\//i.test(s);

// Object shape helpers (keep working logic; allow {actorId} or string id)
function isObjectWithOnlyActorId(v) {
  if (!v || typeof v !== "object") return false;
  const keys = Object.keys(v).filter((k) => v[k] !== undefined);
  return keys.length === 1 && keys[0] === "actorId" && isStr(v.actorId);
}
function isIdStringOrActorObj(v) {
  return isStr(v) || isObjectWithOnlyActorId(v);
}

// ---- core validation -------------------------------------------------------

export default async function validateActivity(a) {
  try {
    const VERBS = await getVerbs();

    // base envelope
    req(a && typeof a === "object", "Invalid activity payload");
    req(isStr(a.actorId), "Must have an actor ID");
    req(isStr(a.type), "Missing activity.type");
    req(VERBS.has(a.type), `Unsupported activity.type: ${a.type}`);
    req(isStr(a.to), "The activity must have a 'to' address");

    // NOTE: We DO NOT globally require objectType when 'object' is present.
    // Each verb asserts exactly what it needs.

    switch (a.type) {
      case "Create": {
        req(has(a.object), "Create requires object");
        req(isStr(a.objectType), "Create requires objectType");
        req(has(a.object.actorId), "Object must have an actor ID");
        break;
      }

      case "Update": {
        req(
          has(a.object) || isStr(a.target),
          "Update requires object or target"
        );
        if (has(a.object)) {
          req(
            isStr(a.objectType),
            "Update requires objectType when object present"
          );
        }
        break;
      }

      case "Delete": {
        req(isStr(a.target), "Delete requires target");
        req(isStr(a.objectType), "Delete requires objectType");
        break;
      }

      case "Reply": {
        req(has(a.object), "Reply requires object");
        req(has(a.object.actorId), "Object must have an actor ID");
        req(a.objectType === "Reply", "Reply requires objectType = 'Reply'");
        req(
          isStr(a.target) ||
            isStr(a.object?.target) ||
            isStr(a.object?.inReplyTo),
          "Reply requires a target (activity.target or object.target/inReplyTo)"
        );
        break;
      }

      case "React": {
        req(isStr(a.objectType), "React requires objectType (of target)");
        req(isStr(a.target), "React requires target (id being reacted to)");
        req(has(a.object), "React requires object (reaction payload)");
        break;
      }

      case "Follow":
      case "Unfollow": {
        // Accept "@user@domain" or {actorId:"@user@domain"}
        req(
          isIdStringOrActorObj(a.object),
          `${a.type} requires object ("@user@domain" or {actorId})`
        );
        break;
      }

      case "Block":
      case "Mute": {
        // Prefer `object` ("@user@domain" or {actorId}), but accept legacy `target`
        const objOK = isIdStringOrActorObj(a.object);
        const legacyOK = isStr(a.target);
        req(
          objOK || legacyOK,
          `${a.type} requires object ("@user@domain" or {actorId})`
        );
        break;
      }

      case "Join":
      case "Leave": {
        const obj = a.object;
        const objIsString = typeof obj === "string" && obj.trim().length > 0;

        const objIsGroupOrEventObj =
          obj &&
          typeof obj === "object" &&
          !Array.isArray(obj) &&
          (obj.objectType === "Group" || obj.objectType === "Event") &&
          typeof obj.id === "string" &&
          obj.id.trim().length > 0;

        req(
          objIsString || objIsGroupOrEventObj,
          `${a.type} requires objectType (Group/Event)`
        );
        // If your handler demands target, the test now sends it; validator can stay lenient here.
        break;
      }

      case "Accept":
      case "Reject": {
        req(
          isStr(a.target) || isStr(a.object),
          `${a.type} requires target (or object)`
        );
        break;
      }

      case "Add":
      case "Remove": {
        // For group role membership via Circles:
        // target = circle id string; object = "@user@domain" or {actorId}
        req(isStr(a.target), `${a.type} requires target (circle id)`);
        req(
          isIdStringOrActorObj(a.object),
          `${a.type} requires object ("@user@domain" or {actorId})`
        );
        break;
      }

      case "Upload": {
        req(
          has(a.object) || isStr(a.target),
          "Upload requires object (file meta) or target"
        );
        if (has(a.object)) {
          req(
            a.objectType === "File",
            "Upload with object requires objectType = 'File'"
          );
        }
        break;
      }

      case "Undo": {
        req(
          isStr(a.target) || isStr(a.object),
          "Undo requires target (or object) of the original action"
        );
        break;
      }

      case "Flag": {
        req(isStr(a.target), "Flag requires target (id being reported)");
        break;
      }

      default: {
        // Handled by dynamic verb discovery; add specifics if needed.
        break;
      }
    }

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function assertValidActivity(a) {
  const res = await validateActivity(a);
  if (!res.success) throw new Error(res.error || "Invalid activity");
  return true;
}
