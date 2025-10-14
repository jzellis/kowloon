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

    const created = await Model.create(activity.object);

    // annotate for downstreams + Undo
    activity.objectId = created.id;
    activity.sideEffects = {
      model: type,
      createdId: created.id,
    };

    return { activity, created };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
