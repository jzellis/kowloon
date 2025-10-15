import route from "#routes/utils/route.js";
import { Group, Circle } from "#schema";

export default route(async ({ req, params, query, set, setStatus }) => {
  const viewerId = req.user?.id || null;
  const groupId = decodeURIComponent(params.id || "");

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
    group.members ? Circle.findOne({ id: group.members }).lean() : null,
    group.admins ? Circle.findOne({ id: group.admins }).lean() : null,
    group.moderators ? Circle.findOne({ id: group.moderators }).lean() : null,
  ]);

  const adminIds = new Set((adminsCircle?.members ?? []).map((m) => m.id));
  const modIds = new Set((modsCircle?.members ?? []).map((m) => m.id));

  const allMembers = (membersCircle?.members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    url: m.url,
    roles: [
      adminIds.has(m.id) ? "admin" : null,
      modIds.has(m.id) ? "moderator" : null,
    ].filter(Boolean),
  }));

  const page = Math.max(1, Number(query.page || 1));
  const itemsPerPage = Math.max(
    1,
    Math.min(200, Number(query.itemsPerPage || 50))
  );
  const start = (page - 1) * itemsPerPage;
  const items = allMembers.slice(start, start + itemsPerPage);

  set("items", items);
  set("count", items.length);
  set("page", page);
  set("itemsPerPage", itemsPerPage);
  set("totalItems", allMembers.length);
});
