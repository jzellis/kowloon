// routes/admin/groups.js
import express from "express";
import route from "../utils/route.js";
import makeCollection from "../utils/makeCollection.js";
import { Group } from "#schema";
import { getSetting } from "#methods/settings/cache.js";
import { getServerActor } from "#methods/settings/schemaHelpers.js";

const router = express.Router({ mergeParams: true });

const ALLOWED_FIELDS = [
  "name", "description", "icon", "rsvpPolicy",
  "to", "canReply", "canReact", "urls", "location",
];

function sanitize(doc) {
  const { _id, __v, signature, ...rest } = doc;
  return rest;
}

function pick(obj, fields) {
  const result = {};
  for (const f of fields) {
    if (f in obj) result[f] = obj[f];
  }
  return result;
}

function getServerActorId() {
  const domain = getSetting("domain");
  return getSetting("actorId") || `@${domain}`;
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

// POST /admin/groups — create a server-owned group
router.post(
  "/",
  route(
    async ({ body, set, setStatus }) => {
      if (!body.name?.trim()) {
        setStatus(400);
        set("error", "name is required");
        return;
      }

      const fields = pick(body, ALLOWED_FIELDS);
      if (!fields.to) fields.to = "@public";

      const group = await Group.create({
        ...fields,
        actorId: getServerActorId(),
        actor: getServerActor(),
      });

      setStatus(201);
      set("group", sanitize(group.toObject()));
    },
    { allowUnauth: false }
  )
);

// PATCH /admin/groups/:id — update a server-owned group
router.patch(
  "/:id",
  route(
    async ({ params, body, set, setStatus }) => {
      const group = await Group.findOne({
        id: decodeURIComponent(params.id),
        deletedAt: null,
      });

      if (!group) {
        setStatus(404);
        set("error", "Group not found");
        return;
      }

      if (group.actorId !== getServerActorId()) {
        setStatus(403);
        set("error", "Only server-owned groups can be edited via this endpoint");
        return;
      }

      const fields = pick(body, ALLOWED_FIELDS);
      Object.assign(group, fields);
      await group.save();

      set("ok", true);
      set("group", sanitize(group.toObject()));
    },
    { allowUnauth: false }
  )
);

// DELETE /admin/groups/:id — soft-delete (default) or hard-delete (?fullDelete=true)
router.delete(
  "/:id",
  route(
    async ({ params, query, user: adminUser, set, setStatus }) => {
      const group = await Group.findOne({ id: decodeURIComponent(params.id) });

      if (!group) {
        setStatus(404);
        set("error", "Group not found");
        return;
      }

      if (query.fullDelete === "true") {
        await Group.deleteOne({ id: group.id });
        set("ok", true);
        set("hardDeleted", true);
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
