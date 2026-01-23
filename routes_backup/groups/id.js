// /routes/groups/id.js
import route from "../utils/route.js";
import { Group, Circle } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";
import { canSeeObject } from "#methods/visibility/helpers.js";

export default route(async ({ req, params, set, setStatus }) => {
  const groupId = decodeURIComponent(params.id || "");
  const group = await Group.findOne({ id: groupId, deletedAt: null }).lean();
  if (!group) {
    setStatus(404);
    set("error", "Not found");
    return;
  }

  const ctx = await getViewerContext(req.user?.id || null);
  if (!canSeeObject(group, ctx)) {
    setStatus(404);
    set("error", "Not found");
    return;
  }

  // Safe memberCount (hide if small or disabled)
  let memberCount;
  if (group.members) {
    const circle = await Circle.findOne({ id: group.members })
      .select("memberCount")
      .lean();
    const raw = circle?.memberCount ?? null;
    const min = Number(process.env.MIN_PUBLIC_MEMBER_COUNT || 5);
    const expose = group?.exposeMemberCountPublic !== false;
    memberCount =
      expose && typeof raw === "number" && raw >= min ? raw : undefined;
  }

  set("item", {
    id: group.id,
    type: "Group",
    name: group.name,
    summary: group.description,
    icon: group.icon,
    url: group.url,
    to: group.to,
    canReply: group.canReply,
    canReact: group.canReact,
    memberCount,
    updatedAt: group.updatedAt,
  });
});
