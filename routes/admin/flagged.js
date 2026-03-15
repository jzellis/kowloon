// routes/admin/flagged.js
import express from "express";
import route from "../utils/route.js";
import makeCollection from "../utils/makeCollection.js";
import { Flag } from "#schema";

const router = express.Router({ mergeParams: true });

function sanitize(doc) {
  const { _id, __v, ...rest } = doc;
  return rest;
}

router.get(
  "/",
  makeCollection({
    model: Flag,
    buildQuery: (req, { query }) => {
      const filter = {};
      filter.status = query.status || "open";
      if (query.targetType) filter.targetType = query.targetType;
      if (query.actorId) filter.actorId = query.actorId;
      return filter;
    },
    sort: { createdAt: -1 },
    sanitize,
    routeOpts: { allowUnauth: false },
  })
);

// GET /admin/flagged/:id
router.get(
  "/:id",
  route(
    async ({ params, set, setStatus }) => {
      const flag = await Flag.findOne({ id: decodeURIComponent(params.id) }).lean();
      if (!flag) {
        setStatus(404);
        set("error", "Flag not found");
        return;
      }
      set("flag", sanitize(flag));
    },
    { allowUnauth: false }
  )
);

// PATCH /admin/flagged/:id — resolve or dismiss
router.patch(
  "/:id",
  route(
    async ({ params, body, user: adminUser, set, setStatus }) => {
      const flag = await Flag.findOne({ id: decodeURIComponent(params.id) });
      if (!flag) {
        setStatus(404);
        set("error", "Flag not found");
        return;
      }

      const { status, notes } = body;
      if (!["resolved", "dismissed"].includes(status)) {
        setStatus(400);
        set("error", "status must be 'resolved' or 'dismissed'");
        return;
      }

      flag.status = status;
      flag.resolvedAt = new Date();
      flag.resolvedBy = adminUser.id;
      if (notes !== undefined) flag.notes = notes;
      await flag.save();

      set("ok", true);
      set("flag", sanitize(flag.toObject()));
    },
    { allowUnauth: false }
  )
);

export default router;
