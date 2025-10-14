// /ActivityParser/validate.js (ESM)
// Discovers verbs by scanning ./handlers/*/index.js at runtime.
// validateActivity(...) -> returns { success: true } OR { success: false, error }
// assertValidActivity(...) -> throws on failure (wraps validateActivity)

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
    // If handlers dir doesn't exist yet, treat as empty
    VERB_CACHE = new Set();
    return VERB_CACHE;
  }

  const verbs = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const verb = e.name;
    const idx = join(HANDLERS_DIR, verb, "index.js");
    if (await fileExists(idx)) verbs.push(verb);
  }

  VERB_CACHE = new Set(verbs);
  return VERB_CACHE;
}

// ---- tiny helpers -----------------------------------------------------------

function has(v) {
  return v !== undefined && v !== null;
}
function isStr(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function req(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---- core validation --------------------------------------------------------

export default async function validateActivity(a) {
  try {
    const VERBS = await getVerbs();

    // Ensure payload is an object *before* property access
    req(a && typeof a === "object", "Invalid activity payload");

    req(isStr(a.actorId), "Must have an actor ID");
    req(isStr(a.type), "Missing activity.type");
    req(VERBS.has(a.type), `Unsupported activity.type: ${a.type}`);
    req(isStr(a.to), "The activity must have a 'to' address");

    // If an object is present, require objectType
    if (has(a.object)) {
      req(
        isStr(a.objectType),
        "Invalid activity: object present but objectType missing"
      );
      // Optional strict parity:
      // if (a.object && typeof a.object === "object" && isStr(a.object.type)) {
      //   req(a.object.type === a.objectType, `Invalid activity: object.type (${a.object.type}) != objectType (${a.objectType})`);
      // }
    }

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
        if (has(a.object))
          req(
            isStr(a.objectType),
            "Update requires objectType when object present"
          );
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
        req(isStr(a.object), `${a.type} requires object (user/server id)`);
        break;
      }
      case "Block":
      case "Mute": {
        req(isStr(a.object), `${a.type} requires object (user/server id)`);
        break;
      }
      case "Join":
      case "Leave": {
        req(isStr(a.objectType), `${a.type} requires objectType (Group/Event)`);
        req(isStr(a.target), `${a.type} requires target (resource id)`);
        break;
      }
      case "Invite": {
        req(has(a.object), "Invite requires object (invitee)");
        req(isStr(a.target), "Invite requires target (Group/Event id)");
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
        req(isStr(a.target), `${a.type} requires target (user id)`);
        req(isStr(a.object), `${a.type} requires object (memberlist key)`);
        req(isStr(a.to), `${a.type} requires to (resource id)`);
        break;
      }
      case "Upload": {
        req(
          has(a.object) || isStr(a.target),
          "Upload requires object (file meta) or target"
        );
        if (has(a.object))
          req(
            a.objectType === "File",
            "Upload with object requires objectType = 'File'"
          );
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
        // New folders/verbs will be allowed by getVerbs(); add specifics here if needed
        break;
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
}

// Throwing version (updated to check res.success)
export async function assertValidActivity(a) {
  const res = await validateActivity(a);
  if (!res.success) throw new Error(res.error || "Invalid activity");
  return true;
}
