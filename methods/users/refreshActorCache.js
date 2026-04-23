// /methods/users/refreshActorCache.js
// When a local user updates their profile, propagate name/icon changes to all
// denormalized actor copies embedded in Post, Reply, React, and FeedItems.object.
// Fire-and-forget: called after the User $set succeeds, does not block the response.

import { Post, Reply, React as ReactModel, FeedItems } from '#schema';

export default async function refreshActorCache(userId, { name, icon } = {}) {
  if (!userId) return;

  const actorPatch = {};
  if (name !== undefined) actorPatch['actor.name'] = name;
  if (icon !== undefined) actorPatch['actor.icon'] = icon;

  const feedPatch = {};
  if (name !== undefined) feedPatch['object.actor.name'] = name;
  if (icon !== undefined) feedPatch['object.actor.icon'] = icon;

  if (!Object.keys(actorPatch).length) return;

  const filter = { 'actor.id': userId };

  try {
    await Promise.all([
      Post.updateMany(filter, { $set: actorPatch }),
      Reply.updateMany(filter, { $set: actorPatch }),
      ReactModel.updateMany(filter, { $set: actorPatch }),
      FeedItems.updateMany({ 'object.actor.id': userId }, { $set: feedPatch }),
    ]);
  } catch (err) {
    console.error(`[refreshActorCache] Failed for ${userId}:`, err.message);
  }
}
