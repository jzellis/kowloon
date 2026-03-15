// routes/admin/groups.js
import express from "express";
import route from "../utils/route.js";
import makeCollection from "../utils/makeCollection.js";
import { Group } from "#schema";

const router = express.Router({ mergeParams: true });

function sanitize(doc) {
  const { _id, __v, ...rest } = doc;
  return rest;
}

router.get(
  "/",
  makeCollection({
    model: Group,
    buildQuery: (req, { query }) => {
      const filter = {};
      if (query.deleted === "true") {
        filter.deletedAt = { $ne: null };
      } else if (query.deleted !== "include") {
        filter.deletedAt = null;
      }
      if (query.rsvpPolicy) filter.rsvpPolicy = query.rsvpPolicy;
      return filter;
    },
    sort: { createdAt: -1 },
    sanitize,
    routeOpts: { allowUnauth: false },
  })
);

// GET /admin/groups/:id
router.get(
  "/:id",
  route(
    async ({ params, set, setStatus }) => {
      const group = await Group.findOne({
        id: decodeURIComponent(params.id),
      }).lean();

      if (!group) {
        setStatus(404);
        set("error", "Group not found");
        return;
      }
      set("group", sanitize(group));
    },
    { allowUnauth: false }
  )
);

// DELETE /admin/groups/:id — soft-delete
router.delete(
  "/:id",
  route(
    async ({ params, user: adminUser, set, setStatus }) => {
      const group = await Group.findOne({ id: decodeURIComponent(params.id) });

      if (!group) {
        setStatus(404);
        set("error", "Group not found");
        return;
      }

      if (group.deletedAt) {
        setStatus(409);
        set("error", "Group already deleted");
        return;
      }

      group.deletedAt = new Date();
      group.deletedBy = adminUser.id;
      await group.save();

      set("ok", true);
      set("group", sanitize(group.toObject()));
    },
    { allowUnauth: false }
  )
);

// POST /admin/groups/:id/restore
router.post(
  "/:id/restore",
  route(
    async ({ params, set, setStatus }) => {
      const group = await Group.findOne({ id: decodeURIComponent(params.id) });

      if (!group) {
        setStatus(404);
        set("error", "Group not found");
        return;
      }

      group.deletedAt = null;
      group.deletedBy = null;
      await group.save();

      set("ok", true);
      set("group", sanitize(group.toObject()));
    },
    { allowUnauth: false }
  )
);

export default router;
