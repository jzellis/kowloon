import { escapeRegExp } from "./utils.js";

export function buildVisibilityQuery(ctx) {
  const base = { deletedAt: null };

  if (!ctx?.isAuthenticated) {
    return { ...base, to: "@public" };
  }

  const or = [];

  // own
  or.push({ actorId: ctx.viewerId });

  // public
  or.push({ to: "@public" });

  if (ctx.viewerDomain) {
    // NEW: explicit domain token
    or.push({ to: `@${ctx.viewerDomain}` });

    // LEGACY: old '@server' docs scoped by actorId domain
    or.push({
      to: "@server",
      actorId: new RegExp(`@${escapeRegExp(ctx.viewerDomain)}$`),
    });
  }

  if (ctx.circleIds.size) or.push({ to: { $in: [...ctx.circleIds] } });
  if (ctx.groupIds.size) or.push({ to: { $in: [...ctx.groupIds] } });

  const filter = { ...base, $or: or };

  if (ctx.blockedActorIds.size) {
    filter.actorId = {
      $nin: [...ctx.blockedActorIds].filter((a) => a !== ctx.viewerId),
    };
  }

  return filter;
}
