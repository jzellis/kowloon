// ActivityParser/React.js (refactored)
// - object is the React (emoji, name, target, etc.)
// - target is the ID of the item being reacted to
// - federate when the target is not on the local server
import getSettings from "../getSettings.js";
import getObjectById from "../getObjectById.js";
import { React } from "../../schema/index.js";

function ensureObject(activity) {
  activity.object = activity.object || {};
  // Prefer explicit object.target; fall back to activity.target
  if (!activity.object.target && activity.target) {
    activity.object.target = activity.target;
  }
}

function embedActor(activity) {
  if (!activity?.object) return;
  if (activity.actorId)
    activity.object.actorId = activity.object.actorId || activity.actorId;
  if (activity.actor)
    activity.object.actor = activity.object.actor || activity.actor;
}

function domainFromId(id) {
  // works for ids like "post:xyz@domain" or "reply:abc@domain" or "@user@domain"
  if (!id || typeof id !== "string") return null;
  const at = id.lastIndexOf("@");
  return at > -1 ? id.slice(at + 1) : null;
}

export default async function ReactVerb(activity) {
  if (!activity?.actorId) throw new Error("Missing actorId");
  if (!activity?.target && !activity?.object?.target)
    throw new Error("React requires a target (string id)");

  // keep private/local addressing by default (no noisy fanout)
  activity.to = activity.actorId;
  activity.replyTo = activity.actorId;
  activity.reactTo = activity.actorId;

  // 1) Normalize the object payload
  ensureObject(activity);

  // Validate minimal fields required by your schema (emoji + name + target)
  const { emoji, name, target } = activity.object;
  if (!target || typeof target !== "string")
    throw new Error("React.target must be a string id");
  if (!emoji) throw new Error("React requires emoji");
  if (!name) throw new Error("React requires name");

  // 2) Stamp actor on the React object
  embedActor(activity);

  // 3) Local vs remote: compare target's domain against our Settings.domain
  const settings = await getSettings();
  const localDomain = settings?.domain;
  const targetDomain = domainFromId(target);

  const isRemote = Boolean(
    targetDomain && localDomain && targetDomain !== localDomain
  );

  // 4) If the target exists locally, increment its reactCount
  try {
    const item = await getObjectById(target);
    if (item) {
      item.reactCount = (item.reactCount || 0) + 1;
      await item.save();
    }
  } catch {
    // non-fatal: target might be remote or of an unknown type locally
  }

  // 5) Create the React document
  const reactDoc = await React.create(activity.object);
  activity.objectId = reactDoc.id;
  activity.object = reactDoc;

  // 6) Human summary
  const actorName = activity.actor?.profile?.name || "Someone";
  const actorIdent = activity.actor?.id || activity.actorId || "unknown actor";
  activity.summary = `${actorName} (${actorIdent}) reacted ${emoji} to ${target}`;

  // 7) Federation policy: send only if target isn't on our server
  if (isRemote) {
    activity.federate = true; // your Outbox/dispatcher uses this (or an allowlist) to deliver
  }

  return activity;
}
