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

  out.canReply = canInteract(obj.replyTo || to, obj.actorId, ctx);
  out.canReact = canInteract(obj.reactTo || to, obj.actorId, ctx);
  return out;
}

export function canSeeObject(obj, ctx) {
  if (!obj) return false;
  const to = obj.to;
  if (to === "@public") return true;
  if (isDomain(to))
    return ctx?.viewerDomain && to.slice(1) === ctx.viewerDomain;
  if (to?.startsWith("circle:")) return !!ctx?.circleIds?.has?.(to);
  if (to?.startsWith("group:")) return !!ctx?.groupIds?.has?.(to);
  return false;
}
