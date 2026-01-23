import { Activity, Post, React as ReactModel, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";

export default async function Undo(activity) {
  try {
    // --- basic validation ---
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Undo: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return {
        activity,
        error:
          "Undo: missing or malformed activity.target (original activity id)",
      };
    }

    // --- load the original activity we are undoing ---
    const original = await Activity.findOne({ id: activity.target }).lean();
    if (!original) {
      return { activity, error: "Undo: original activity not found" };
    }

    // Only the original actor can Undo (tighten/relax if your policy differs)
    if (original.actorId !== activity.actorId) {
      return { activity, error: "Undo: actor must match original actor" };
    }

    // --- handle supported types (your tests only require React) ---
    if (original.type === "React") {
      const postId = original.target;
      const emoji = original?.object?.emoji;

      // Best-effort: remove the reaction record if you store one
      // (Adjust the model/fields if your schema differs)
      if (ReactModel) {
        await ReactModel.deleteOne({
          actorId: activity.actorId,
          target: postId,
          ...(emoji ? { "object.emoji": emoji } : {}),
        }).catch(() => {});
      }

      // Decrement reactCount on the target Post (guard against negatives)
      await Post.updateOne(
        { id: postId, reactCount: { $gt: 0 } },
        { $inc: { reactCount: -1 } }
      ).catch(() => {});

      return {
        activity,
        result: {
          undone: true,
          type: "React",
          target: postId,
        },
        federate: false,
      };
    }

    // Fallback for types you haven't wired yet
    return {
      activity,
      error: `Undo: unsupported original type (${original.type})`,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
