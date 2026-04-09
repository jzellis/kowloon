// routes/circles/id.js
// GET /circles/:id — Circle details (authorized users)
//
// "Authorized" means:
//   - @public circles: anyone
//   - @server circles: any authenticated user on this server
//   - circle-addressed: owner + members of that circle
//   - private / empty: owner only

import route from "../utils/route.js";
import { Circle } from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

export default route(async ({ req, params, user, set, setStatus }) => {
  const id = decodeURIComponent(params.id);
  const circle = await Circle.findOne({ id, deletedAt: null }).lean();

  if (!circle) {
    setStatus(404);
    set("error", "Circle not found");
    return;
  }

  const { domain } = getServerSettings();
  const to = circle.to || "";
  const isPublic = to === "@public" || to === "public";
  const isServerVisible =
    to === `@${domain}` || to === "@server" || to === "server";
  const isOwner = user?.id && circle.actorId === user?.id;
  const isMember =
    user?.id && circle.members?.some((m) => m.id === user?.id);

  if (!isPublic) {
    if (!user?.id) {
      setStatus(401);
      set("error", "Authentication required");
      return;
    }
    if (!isOwner && !isMember && !isServerVisible) {
      setStatus(403);
      set("error", "Access denied");
      return;
    }
  }

  // Expose isOwner and isMember to the client so the UI can gate actions
  const result = { ...circle, isOwner: !!isOwner, isMember: !!isMember };
  set("item", result);
});
