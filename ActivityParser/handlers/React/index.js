// /ActivityParser/handlers/React/index.js

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
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";
import Settings from "#schema/Settings.js";

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

export default async function React(activity) {
  try {
    // ---- Validation ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "React: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "React: missing activity.target" };
    }
    if (!activity?.object || typeof activity.object !== "object") {
      return { activity, error: "React: missing activity.object" };
    }
    const { emoji, name } = activity.object || {};
    if (!emoji || !name) {
      return {
        activity,
        error: "React: object.emoji and object.name are required",
      };
    }

    // ---- Create the React record ----
    const reactDoc = await ReactModel.create({
      target: activity.target,
      actorId: activity.actorId,
      actor: activity.actor, // optional passthrough
      emoji,
      name,
      // server/id minted by schema hooks
    });

    // annotate for downstreams + Undo
    activity.objectId = reactDoc.id;

    // ---- Figure out if target is local & which model to bump ----
    const parsed = kowloonId(activity.target); // { type, domain } or { type:"URL", domain }
    const TargetModel = MODELS[parsed?.type];
    const targetLocal = await objectById(activity.target); // null if remote/unknown
    const ourDomain = (await Settings.findOne({ name: "domain" }).lean())
      ?.value;

    // ---- Try to increment reactCount on the target if it has that field ----
    let reactCountUpdated = false;

    if (TargetModel && targetLocal) {
      const targetDoc = await TargetModel.findOne(
        { id: activity.target },
        { reactCount: 1 }
      ).lean();

      if (
        targetDoc &&
        Object.prototype.hasOwnProperty.call(targetDoc, "reactCount")
      ) {
        const updated = await TargetModel.findOneAndUpdate(
          { id: activity.target },
          { $inc: { reactCount: 1 } },
          { new: true }
        );
        reactCountUpdated = Boolean(updated);
      }
    }

    // ---- Side effects for Undo ----
    activity.sideEffects = {
      reactId: reactDoc.id,
      bumpedTargetId: reactCountUpdated ? activity.target : undefined,
    };

    // ---- Federation hint: if target appears remote, ask upstream to federate ----
    const federate =
      !targetLocal &&
      Boolean(parsed?.domain) &&
      ourDomain &&
      parsed.domain !== ourDomain;

    return {
      activity,
      react: reactDoc,
      reactCountUpdated,
      federate,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
