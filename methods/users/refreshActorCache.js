// /methods/users/refreshActorCache.js
// When a local user updates their profile, propagate name/icon changes to all
// denormalized actor copies embedded throughout the DB:
//   - Post / Reply / React / Circle / Group / Page : top-level `actor` subdoc
//   - Circle.members[] : also reaches Group system circles
//   - FeedItems.object.actor : feed cache
//   - Notification.{actorName,actorIcon} : flat denormalized fields
//
// Fire-and-forget: called after the User $set succeeds, does not block the
// activity response.
//
// TODO: this runs inline in the Update handler. For users with lots of
// content these updateMany calls can fan out to thousands of writes. Move to
// a dedicated background worker (alongside other deferred jobs like remote
// actor refresh, federation push retries, image transcoding, etc.) before
// scaling beyond a small alpha.

import {
  Post,
  Reply,
  React as ReactModel,
  FeedItems,
  Circle,
  Group,
  Page,
  Notification,
} from '#schema';

export default async function refreshActorCache(userId, { name, icon } = {}) {
  if (!userId) return;
  if (name === undefined && icon === undefined) return;

  // Embedded top-level `actor.{name,icon}`.
  const actorPatch = {};
  if (name !== undefined) actorPatch['actor.name'] = name;
  if (icon !== undefined) actorPatch['actor.icon'] = icon;

  // Embedded `object.actor.{name,icon}` on FeedItems.
  const feedPatch = {};
  if (name !== undefined) feedPatch['object.actor.name'] = name;
  if (icon !== undefined) feedPatch['object.actor.icon'] = icon;

  // Positional update for Circle.members[] (also covers Group system circles
  // since Groups store members inside their circles, not on the Group itself).
  const memberPatch = {};
  if (name !== undefined) memberPatch['members.$[m].name'] = name;
  if (icon !== undefined) memberPatch['members.$[m].icon'] = icon;

  // Top-level denormalized fields on Notification.
  const notificationPatch = {};
  if (name !== undefined) notificationPatch.actorName = name;
  if (icon !== undefined) notificationPatch.actorIcon = icon;

  try {
    await Promise.all([
      Post.updateMany({ 'actor.id': userId }, { $set: actorPatch }),
      Reply.updateMany({ 'actor.id': userId }, { $set: actorPatch }),
      ReactModel.updateMany({ 'actor.id': userId }, { $set: actorPatch }),
      Circle.updateMany({ 'actor.id': userId }, { $set: actorPatch }),
      Group.updateMany({ 'actor.id': userId }, { $set: actorPatch }),
      Page.updateMany({ 'actor.id': userId }, { $set: actorPatch }),
      FeedItems.updateMany({ 'object.actor.id': userId }, { $set: feedPatch }),
      Circle.updateMany(
        { 'members.id': userId },
        { $set: memberPatch },
        { arrayFilters: [{ 'm.id': userId }] }
      ),
      Notification.updateMany({ actorId: userId }, { $set: notificationPatch }),
    ]);
  } catch (err) {
    console.error(`[refreshActorCache] Failed for ${userId}:`, err.message);
  }
}
