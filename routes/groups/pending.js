// routes/groups/pending.js
// GET /groups/:id/pending — Pending join requests for a group.
//
// Gated on the requester being a member of group.circles.admins. The pending
// circle itself can't be read via the generic getCircle route because its
// actorId is the group's ID, not the requesting admin's — so we expose this
// dedicated route to keep group moderation usable end-to-end without opening
// up the generic circle visibility model.

import route from "../utils/route.js";
import { Group, Circle } from "#schema";

export default route(
  async ({ params, user, set, setStatus }) => {
    const groupId = decodeURIComponent(params.id);
    const group = await Group.findOne({ id: groupId, deletedAt: null }).lean();

    if (!group) {
      setStatus(404);
      set("error", "Group not found");
      return;
    }

    const adminsCircleId = group.circles?.admins;
    if (!adminsCircleId) {
      setStatus(403);
      set("error", "Access denied");
      return;
    }

    // Is the requester in the admins circle?
    const adminsCircle = await Circle.findOne({
      id: adminsCircleId,
      "members.id": user.id,
    })
      .select("_id")
      .lean();
    if (!adminsCircle) {
      setStatus(403);
      set("error", "Access denied");
      return;
    }

    // Fetch pending members.
    const pendingCircleId = group.circles?.pending;
    if (!pendingCircleId) {
      set("pending", []);
      set("totalItems", 0);
      return;
    }
    const pending = await Circle.findOne({ id: pendingCircleId })
      .select("members")
      .lean();
    const items = (pending?.members || []).map((m) => ({
      id: m.id,
      name: m.name,
      icon: m.icon,
      url: m.url,
    }));

    set("pending", items);
    set("totalItems", items.length);
  },
  { allowUnauth: false }
);
