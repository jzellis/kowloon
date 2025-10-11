// #methods/visibility/helpers.js
import { domainOf } from "./context.js";

const isCircleId = (s) => typeof s === "string" && s.startsWith("circle:");
const isGroupId = (s) => typeof s === "string" && s.startsWith("group:");

export function canInteract(to, actorId, ctx) {
  if (!ctx?.isAuthenticated) return false;
  if (actorId === ctx.viewerId) return true;

  if (to === "@public") return true;
  if (to === "@server") return domainOf(actorId) === ctx.viewerDomain;
  if (isCircleId(to)) return ctx.circleIds.has(to);
  if (isGroupId(to)) return ctx.groupIds.has(to);
  return false;
}

export function sanitizeAudience(obj, ctx) {
  if (!obj) return obj;
  const out = { ...obj };
  const to = obj.to;

  if (to === "@public") {
    out.visibility = "public";
  } else if (to === "@server") {
    out.visibility = "server";
  } else if (isGroupId(to)) {
    out.visibility = "group"; // groups are visible entities → keep id
  } else if (isCircleId(to)) {
    out.visibility = "circle";
    out.to = "@private"; // never leak circle ids
  }

  out.canReply = canInteract(obj.replyTo || to, obj.actorId, ctx);
  out.canReact = canInteract(obj.reactTo || to, obj.actorId, ctx);
  return out;
}
