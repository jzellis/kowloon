// /methods/createActivity.js
// Validates an incoming Activity against the Ajv JSON Schema, then routes to the verb handler.

import { Activity, Outbox, User } from "../schema/index.js";
import ActivityParser from "./ActivityParser/index.js";
import getSettings from "./getSettings.js";
import parseId from "./parseId.js";
import shouldFederate from "./shouldFederate.js";
// === Ajv setup ===
import Ajv from "ajv";
import addFormats from "ajv-formats";
import activitySchema from "./ActivityParser/validators/activity.js";

// compile once at module load
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  // NOTE: if you later decide to allow missing to/replyTo/reactTo and let Mongoose fill them,
  // set useDefaults: "empty" and add defaults to the schema. Right now the schema requires them.
});
addFormats(ajv);
const validate = ajv.compile(activitySchema);

// Only these types federate by default; others must set activity.federate = true explicitly
const FEDERATE_TYPES = new Set([
  "Create", // e.g., posts you choose to federate later
  "Announce",
  // Reply/React federation is decided conditionally (remote-only) below
]);

function domainFromId(id) {
  if (!id || typeof id !== "string") return null;
  const at = id.lastIndexOf("@");
  return at > -1 ? id.slice(at + 1) : null;
}

function shouldFederateByTarget(activity, localDomain) {
  // Pull a plausible target id from common fields
  const targetId =
    activity?.object?.target || activity?.replyTo || activity?.target || null;

  if (!targetId || !localDomain) return false;
  const targetDomain = domainFromId(targetId);
  return Boolean(targetDomain && targetDomain !== localDomain);
}

function formatAjvErrors(errors = []) {
  // Compact, dev-friendly messages (path → message)
  return errors.map((e) => {
    const path = e.instancePath || e.schemaPath || "";
    const where = path ? `(${path})` : "";
    const details = e.message ? `: ${e.message}` : "";
    return `Validation error ${where}${details}`;
  });
}

export default async function createActivity(activity) {
  try {
    // 1) Schema validation (pure shape/constraints)
    const ok = validate(activity);
    if (!ok) {
      const msgs = formatAjvErrors(validate.errors);
      const err = new Error(`Invalid Activity payload.\n${msgs.join("\n")}`);
      err.status = 400;
      throw err;
    }

    // 2) Resolve actor (user/server) with lean guard
    const parsed = parseId(activity.actorId);
    if (!parsed?.type) {
      const err = new Error("Invalid actorId");
      err.status = 400;
      throw err;
    }

    if (parsed.type === "User") {
      const actor = await User.findOne({ id: activity.actorId })
        .select("-_id id profile publicKey type url inbox outbox")
        .lean();
      if (!actor) {
        const err = new Error(`Actor not found: ${activity.actorId}`);
        err.status = 404;
        throw err;
      }
      activity.actor = actor;
    } else if (parsed.type === "Server") {
      const settings = await getSettings();
      activity.actor = {
        id: settings.actorId,
        profile: settings.profile,
        publicKey: settings.publicKey,
      };
    } else {
      const err = new Error(`Unsupported actor type: ${parsed.type}`);
      err.status = 400;
      throw err;
    }

    // 3) Route to verb handler
    const handler = ActivityParser[activity.type];
    if (!handler) {
      const valid = Object.keys(ActivityParser).join(", ");
      const err = new Error(
        `Invalid activity type "${activity.type}". Valid types: ${valid}`
      );
      err.status = 400;
      throw err;
    }

    // 4) Execute verb-specific logic
    activity = await handler(activity);

    // 5) Default-stamp object's actor/actorId only if missing (leave hooks to do the rest)
    if (activity.object && typeof activity.object === "object") {
      activity.object.actor ??= activity.actor;
      activity.object.actorId ??= activity.actorId;
    }

    // 6) Auto-flag federation for remote Reply/React targets
    //    - Reply comes through as type "Create" with objectType "Reply"
    //    - React is type "React"
    if (!activity.federate) {
      const settings = await getSettings();
      const isReply =
        activity.type === "Create" &&
        (activity.objectType === "Reply" || activity.object?.type === "Reply");
      const isReact = activity.type === "React";

      if (
        (isReply || isReact) &&
        shouldFederateByTarget(activity, settings?.domain)
      ) {
        activity.federate = true;
      }
    }

    // 7) Persist (if handler didn't signal an error)
    if (activity.error) {
      // keep your existing convention
      console.log("Error:", activity.error);
      return activity;
    }

    activity = await Activity.create(activity);

    // 8) Conditional delivery enqueue
    if (shouldFederate(activity)) {
      await Outbox.findOneAndUpdate(
        { "activity.id": activity.id },
        { activity },
        { new: true, upsert: true }
      );
    }

    return activity;
  } catch (e) {
    console.log(e);
    // Bubble HTTP-ish status if you threw one above
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}
