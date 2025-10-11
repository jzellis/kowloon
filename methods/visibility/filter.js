// #methods/visibility/filter.js
import { escapeRegExp } from "./utils.js";

export function buildVisibilityQuery(ctx) {
  const base = { deletedAt: null };

  if (!ctx?.isAuthenticated) {
    return { ...base, to: "@public" };
  }

  const or = [];

  // 👇 NEW: always include your own objects
  or.push({ actorId: ctx.viewerId });

  // public
  or.push({ to: "@public" });

  // server-only from same domain
  if (ctx.viewerDomain) {
    or.push({
      to: "@server",
      actorId: new RegExp(`@${escapeRegExp(ctx.viewerDomain)}$`),
    });
  }

  // circles you're in
  if (ctx.circleIds.size) {
    or.push({ to: { $in: [...ctx.circleIds] } });
  }

  // groups you're in
  if (ctx.groupIds.size) {
    or.push({ to: { $in: [...ctx.groupIds] } });
  }

  const filter = { ...base, $or: or };

  // exclude blocked authors -- but never exclude yourself
  if (ctx.blockedActorIds.size) {
    filter.actorId = {
      $nin: [...ctx.blockedActorIds].filter((a) => a !== ctx.viewerId),
    };
  }

  return filter;
}
