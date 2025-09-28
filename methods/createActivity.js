// createActivity.js (refactored with auto-federation for remote Reply/React)
import { Activity, Outbox, User } from "../schema/index.js";
import ActivityParser from "./ActivityParser/index.js";
import getSettings from "./getSettings.js";
import parseId from "./parseId.js";
import validateActivity from "./validateActivity.js";

// Only these types federate by default; others must set activity.federate = true explicitly
const FEDERATE_TYPES = new Set([
  "Create", // e.g., posts you choose to federate later
  "Announce",
  // Note: Reply/React are handled conditionally below (remote-only)
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

export default async function createActivity(activity) {
  try {
    // 1) Validate shape early
    activity = validateActivity(activity);

    // 2) Resolve actor (user/server) with lean guard
    const parsed = parseId(activity.actorId);
    if (!parsed?.type) throw new Error("Invalid actorId");

    if (parsed.type === "User") {
      const actor = await User.findOne({ id: activity.actorId })
        .select("-_id id profile publicKey type url inbox outbox")
        .lean();
      if (!actor) throw new Error(`Actor not found: ${activity.actorId}`);
      activity.actor = actor;
    } else if (parsed.type === "Server") {
      const settings = await getSettings();
      activity.actor = {
        id: settings.actorId,
        profile: settings.profile,
        publicKey: settings.publicKey,
      };
    } else {
      throw new Error(`Unsupported actor type: ${parsed.type}`);
    }

    // 3) Route to verb handler
    const handler = ActivityParser[activity.type];
    if (!handler) {
      const valid = Object.keys(ActivityParser).join(", ");
      throw new Error(
        `Invalid activity type "${activity.type}". Valid types: ${valid}`
      );
    }

    activity = await handler(activity); // verb-specific side effects

    // 4) Default-stamp object's actor/actorId only if missing
    if (activity.object && typeof activity.object === "object") {
      activity.object.actor ??= activity.actor;
      activity.object.actorId ??= activity.actorId;
    }

    // 4.1) Auto-flag federation for remote Reply/React targets
    //      - Reply comes through as type "Create" with objectType "Reply"
    //      - React is type "React"
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

    // 5) Persist activity (skip if verb reported an error)
    if (activity.error) {
      console.log("Error:", activity.error);
      return activity;
    }

    activity = await Activity.create(activity);

    // 6) Conditional delivery enqueue
    const shouldFederate =
      activity.federate === true || FEDERATE_TYPES.has(activity.type);

    if (shouldFederate) {
      await Outbox.findOneAndUpdate(
        { "activity.id": activity.id },
        { activity },
        { new: true, upsert: true }
      );
    }

    return activity;
  } catch (e) {
    console.log(e);
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}
