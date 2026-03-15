// routes/admin/circles.js
// Admin view of user-created circles (type: "Circle") — read-only
import express from "express";
import route from "../utils/route.js";
import makeCollection from "../utils/makeCollection.js";
import { Circle } from "#schema";

const router = express.Router({ mergeParams: true });

function sanitize(doc) {
  const { _id, __v, ...rest } = doc;
  return rest;
}

router.get(
  "/",
  makeCollection({
    model: Circle,
    buildQuery: (req, { query }) => {
      const filter = {};
      // Default: user-created circles that are public/server-visible
      if (query.type) {
        filter.type = query.type;
      } else {
        filter.type = "Circle";
      }
      if (query.actorId) filter.actorId = query.actorId;
      if (query.to) filter.to = query.to;
      return filter;
    },
    sort: { createdAt: -1 },
    sanitize,
    routeOpts: { allowUnauth: false },
  })
);

// GET /admin/circles/:id
router.get(
  "/:id",
  route(
    async ({ params, set, setStatus }) => {
      const circle = await Circle.findOne({
        id: decodeURIComponent(params.id),
      }).lean();

      if (!circle) {
        setStatus(404);
        set("error", "Circle not found");
        return;
      }
      set("circle", sanitize(circle));
    },
    { allowUnauth: false }
  )
);

export default router;
