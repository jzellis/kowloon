// routes/admin/activities.js
import express from "express";
import makeCollection from "../utils/makeCollection.js";
import { Activity } from "#schema";

const router = express.Router({ mergeParams: true });

function sanitize(doc) {
  const { _id, __v, ...rest } = doc;
  return rest;
}

router.get(
  "/",
  makeCollection({
    model: Activity,
    buildQuery: (req, { query }) => {
      const filter = {};
      if (query.type) filter.type = query.type;
      if (query.actorId) filter.actorId = query.actorId;
      if (query.objectType) filter.objectType = query.objectType;
      return filter;
    },
    sort: { createdAt: -1 },
    sanitize,
    routeOpts: { allowUnauth: false },
  })
);

export default router;
