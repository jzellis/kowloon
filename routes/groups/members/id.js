import route from "../../utils/route.js";
import { Group, Circle } from "#schema";

export default route(async ({ req, params, set, setStatus }) => {
  const viewerId = req.user?.id || null;
  const groupId = decodeURIComponent(params.id || "");
  const memberId = decodeURIComponent(params.memberId || "");

  const group = await Group.findOne({ id: groupId, deletedAt: null }).lean();
  if (!group) {
    setStatus(404);
    set("error", "Not found");
    return;
  }

  const isAdmin = !!req.user?.isAdmin;
  const isMember =
    viewerId && group.members
      ? !!(await Circle.exists({ id: group.members, "members.id": viewerId }))
      : false;

  if (!isMember && !isAdmin) {
    setStatus(403);
    set("error", "Forbidden");
    return;
  }

  const [membersCircle, adminsCircle, modsCircle] = await Promise.all([
    group.members
      ? Circle.findOne({ id: group.members }, { members: 1 }).lean()
      : null,
    group.admins
      ? Circle.findOne({ id: group.admins }, { members: 1 }).lean()
      : null,
    group.moderators
      ? Circle.findOne({ id: group.moderators }, { members: 1 }).lean()
      : null,
  ]);

  const m = (membersCircle?.members ?? []).find((x) => x.id === memberId);
  if (!m) {
    setStatus(404);
    set("error", "Member not found");
    return;
  }

  const adminIds = new Set((adminsCircle?.members ?? []).map((x) => x.id));
  const modIds = new Set((modsCircle?.members ?? []).map((x) => x.id));

  set("item", {
    id: m.id,
    name: m.name,
    icon: m.icon,
    url: m.url,
    roles: [
      adminIds.has(m.id) ? "admin" : null,
      modIds.has(m.id) ? "moderator" : null,
    ].filter(Boolean),
  });
  set("count", 1);
});
