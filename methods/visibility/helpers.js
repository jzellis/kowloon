// /methods/visibility/helpers.js
import { domainOf } from "./context.js";

const isCircleId = (s) => typeof s === "string" && s.startsWith("circle:");
const isGroupId = (s) => typeof s === "string" && s.startsWith("group:");
const isDomain = (s) =>
  typeof s === "string" && s.startsWith("@") && !["@public"].includes(s);

export function canInteract(to, actorId, ctx) {
  if (!ctx?.isAuthenticated) return false;
  if (actorId === ctx.viewerId) return true;

  if (to === "@public") return true;
  if (isDomain(to)) return to.slice(1) === ctx.viewerDomain; // @kwln.org
  if (isCircleId(to)) return ctx.circleIds.has(to);
  if (isGroupId(to)) return ctx.groupIds.has(to);
  return false;
}

export function sanitizeAudience(obj, ctx) {
  if (!obj) return obj;
  const out = { ...obj };
  const to = obj.to;

  if (to === "@public") out.visibility = "public";
  else if (isDomain(to)) out.visibility = "domain"; // keep exact token in `to`
  else if (isGroupId(to)) out.visibility = "group";
  else if (isCircleId(to)) {
    out.visibility = "circle";
    out.to = "@private";
  }

  out.canReply = canInteract(obj.canReply || to, obj.actorId, ctx);
  out.canReact = canInteract(obj.canReact || to, obj.actorId, ctx);
  return out;
}

export async function canSeeObject(obj, ctx) {
  if (!obj) return false;
  const to = obj.to;

  // Public objects are always visible
  if (to === "@public") return true;

  // Domain-scoped: viewer must be from that domain
  if (isDomain(to)) {
    return !!(ctx?.viewerDomain && to.slice(1) === ctx.viewerDomain);
  }

  // Circle-scoped: viewer must be a member of that circle
  if (to?.startsWith("circle:")) {
    return !!ctx?.circleIds?.has?.(to);
  }

  // Group-scoped: check if viewer is a member OR if group is public
  if (to?.startsWith("group:")) {
    // First check if user is a member
    if (ctx?.groupIds?.has?.(to)) return true;

    // If not a member, check if group itself is public
    const { Group } = await import("#schema");
    const group = await Group.findOne({ id: to }).select("to").lean();
    if (!group) return false;

    // Group is visible if it's addressed to @public
    return group.to === "@public";
  }

  return false;
}
