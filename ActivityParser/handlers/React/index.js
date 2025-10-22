// #ActivityParser/handlers/React/index.js
// Creates (idempotently) a React record and bumps reactCount on the target.
// Ensures: objectType === "React", target is required, and object.react is provided.
// Works for Post/Page/Bookmark/Event/Group targets if present in #schema.

import { React as ReactModel, Post, Page, Bookmark, Event, Group } from "#schema";

export default async function React(activity, ctx = {}) {
  const actorId = activity.actorId;
  const targetId =
    activity.target ||
    (typeof activity.object === "string"
      ? activity.object
      : activity.object?.id);

  const reactKind =
    (activity.object && (activity.object.react || activity.object.type)) || undefined;

  if (!actorId || !targetId) {
    return { activity, error: "React: missing actorId or target" };
  }
  if (activity.objectType !== "React") {
    return { activity, error: 'React: objectType must be "React"' };
  }
  if (!reactKind || typeof reactKind !== "string") {
    return { activity, error: "React: object.react (string) is required" };
  }

  // Idempotent upsert of the React document (natural key: actorId + target + react)
  const up = await ReactModel.updateOne(
    { actorId, target: targetId, react: reactKind },
    { $setOnInsert: { actorId, target: targetId, react: reactKind, createdAt: new Date() } },
    { upsert: true }
  );

  if ((up.upsertedCount || 0) === 0 && (up.matchedCount || 0) > 0) {
    // Already had this reaction
    return { activity, result: { status: "already_reacted" } };
  }

  // Try to bump reactCount on a known target collection
  const inc = { $inc: { reactCount: 1 } };
  let bumped = false;
  const models = [Post, Page, Bookmark, Event, Group];
  for (const Model of models) {
    try {
      if (!Model) continue;
      const r = await Model.updateOne({ id: targetId }, inc);
      if (r && r.modifiedCount > 0) { bumped = true; break; }
    } catch (e) {
      // ignore model mismatches
    }
  }

  return { activity, result: { status: "reacted", react: reactKind, bumped } };
}
