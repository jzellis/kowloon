// /ActivityParser/handlers/Delete/index.js

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
import kowloonId from "#methods/parse/kowloonId.js";

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

export default async function Delete(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Delete: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Delete: missing activity.target" };
    }

    const parsed = kowloonId(activity.target);
    const Model = MODELS[parsed?.type];
    if (!Model) {
      return {
        activity,
        error: `Delete: unsupported target type "${parsed?.type}"`,
      };
    }

    const query =
      parsed.type === "URL"
        ? { url: activity.target }
        : { id: activity.target };

    const deleted =
      (await Model.findOneAndUpdate(
        query,
        { $set: { deletedAt: new Date(), deletedBy: activity.actorId } },
        { new: true }
      ).lean?.()) ??
      (await Model.findOneAndUpdate(
        query,
        { $set: { deletedAt: new Date(), deletedBy: activity.actorId } },
        { new: true }
      ));

    if (!deleted) {
      return {
        activity,
        error: `Delete: target not found: ${activity.target}`,
      };
    }

    // annotate for downstreams + Undo
    activity.objectId = deleted.id;
    activity.sideEffects = {
      model: parsed.type,
      softDeletedId: deleted.id,
    };

    return { activity, deleted };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
