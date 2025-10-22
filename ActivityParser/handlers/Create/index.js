// /ActivityParser/handlers/Create/index.js

import {
  Bookmark,
  Circle,
  Event,
  Group,
  Page,
  Post,
  React as ReactModel,
  Reply,
  User,
  Settings, // <- ensure Settings is exported from #schema/index.js
} from "#schema";

const MODELS = {
  Bookmark,
  Circle,
  Event,
  Group,
  Page,
  Post,
  React: ReactModel,
  Reply,
  User,
};

export default async function Create(activity) {
  try {
    const type = activity?.objectType;
    if (!type || typeof type !== "string") {
      return { activity, error: "Create: missing activity.objectType" };
    }

    const Model = MODELS[type];
    if (!Model) {
      return { activity, error: `Create: unsupported objectType "${type}"` };
    }

    if (!activity?.object || typeof activity.object !== "object") {
      return { activity, error: "Create: missing activity.object" };
    }

    // ---- Special handling for Create → User --------------------------------
    if (type === "User") {
      const obj = { ...activity.object };

      // Accept either password or legacy "pass" field; normalize to "password"
      if (obj.pass && !obj.password) obj.password = obj.pass;
      delete obj.pass;

      // We need a username. If actorId is present, derive username from it.
      let username = obj.username;
      let actorIdFromObject = obj.actorId || obj.id; // activity requires object.actorId, but model uses "id"
      if (
        !username &&
        actorIdFromObject &&
        typeof actorIdFromObject === "string"
      ) {
        // supports "@user@domain" and plain "user@domain"
        const handle = actorIdFromObject.startsWith("@")
          ? actorIdFromObject.slice(1)
          : actorIdFromObject;
        username = handle.split("@")[0];
      }

      if (!username || typeof username !== "string") {
        return {
          activity,
          error:
            "Create User: 'username' (or object.actorId with username) is required",
        };
      }

      // Ensure the model "id" field (actor handle) is set consistently
      // If object.actorId is provided, prefer it; otherwise mint from settings.domain
      let actorId = actorIdFromObject;
      if (!actorId) {
        const domainSetting = await Settings.findOne({ name: "domain" }).lean();
        const domain = domainSetting?.value;
        if (!domain) {
          return {
            activity,
            error: "Create User: cannot mint actorId (missing Settings.domain)",
          };
        }
        actorId = `@${username}@${domain}`;
      }
      // Map to schema field "id" (User schema treats `id` as the actor handle)
      obj.id = actorId;

      // The rest (inbox/outbox/url/server/keys) is handled by UserSchema.pre('save')
      const created = await User.create(obj);

      activity.objectId = created.id;
      return { activity, created };
    } else {
      // For everything but User, we need to ensure object.actor is present
      if (activity.object.actorId && !activity.object.actor)
        activity.object.actor = activity.actor || {};
    }

    // ---- Generic path for other object types -------------------------------
    // If object.actorId is missing, many models will tolerate it, but your
    // outbox added a fallback already. We leave it as-is here.
    const created = await Model.create(activity.object);

    activity.objectId = created.id;

    return { activity, created };
  } catch (err) {
    // Surface useful info for E11000 etc.
    const payload = {
      message: err?.message || String(err),
    };
    if (err?.code) payload.code = err.code;
    if (err?.keyValue) payload.keyValue = err.keyValue;

    return { activity, error: payload.message, result: payload };
  }
}
