// routes/groups/members.js
// GET /groups/:id/members — Group members list
//
// Visibility gated by the group's `to` field via canSeeObject: public is
// always visible, @<domain> requires local-authed, circle:<id> requires the
// viewer be a member of that circle.

import route from "../utils/route.js";
import { Group, Circle } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";
import { canSeeObject } from "#methods/visibility/helpers.js";

export default route(async ({ params, user, set, setStatus }) => {
  const groupId = decodeURIComponent(params.id);
  const group = await Group.findOne({ id: groupId, deletedAt: null }).lean();

  if (!group) {
    setStatus(404);
    set("error", "Group not found");
    return;
  }

  // Single visibility check covering all three tiers.
  const ctx = await getViewerContext(user?.id || null);
  if (!(await canSeeObject(group, ctx))) {
    setStatus(user?.id ? 403 : 401);
    set("error", user?.id ? "Access denied" : "Authentication required");
    return;
  }

  // Get members from the group's members circle
  if (!group.circles?.members) {
    set("members", []);
    set("totalItems", 0);
    return;
  }

  const membersCircle = await Circle.findOne({ id: group.circles.members })
    .select("members")
    .lean();

  const members = (membersCircle?.members || []).map((m) => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    url: m.url,
  }));

  set("members", members);
  set("totalItems", members.length);
});
