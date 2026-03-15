// routes/admin/pages.js — Admin CRUD for server Pages
import express from "express";
import route from "../utils/route.js";
import makeCollection from "../utils/makeCollection.js";
import { Page } from "#schema";
import { getSetting } from "#methods/settings/cache.js";

const router = express.Router({ mergeParams: true });

// Fields admins can set on create/update
const ALLOWED_FIELDS = [
  "type", "title", "slug", "summary", "parentFolder", "order",
  "source", "image", "attachments", "tags", "to", "canReply", "canReact", "href",
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

router.get(
  "/",
  makeCollection({
    model: Page,
    buildQuery: (req, { query }) => {
      const filter = {};
      if (query.deleted === "true") {
        filter.deletedAt = { $ne: null };
      } else if (query.deleted !== "include") {
        filter.deletedAt = null;
      }
      if (query.type) filter.type = query.type;
      if (query.parentFolder) filter.parentFolder = query.parentFolder;
      return filter;
    },
    select: "-signature",
    sort: { order: 1, createdAt: -1 },
    sanitize,
    routeOpts: { allowUnauth: false },
  })
);

// GET /admin/pages/:id
router.get(
  "/:id",
  route(
    async ({ params, set, setStatus }) => {
      const idOrSlug = decodeURIComponent(params.id);
      const page = await Page.findOne({
        $or: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      })
        .select("-signature")
        .lean();

      if (!page) {
        setStatus(404);
        set("error", "Page not found");
        return;
      }
      set("page", sanitize(page));
    },
    { allowUnauth: false }
  )
);

// POST /admin/pages — create
router.post(
  "/",
  route(
    async ({ body, user: adminUser, set, setStatus }) => {
      if (!body.title) {
        setStatus(400);
        set("error", "title is required");
        return;
      }

      const domain = getSetting("domain");
      const serverActorId = getSetting("actorId") || `@${domain}`;

      const fields = pick(body, ALLOWED_FIELDS);

      // Default visibility to public if not specified
      if (!fields.to) fields.to = "@public";

      const page = await Page.create({
        ...fields,
        actorId: serverActorId,
      });

      setStatus(201);
      set("page", sanitize(page.toObject()));
    },
    { allowUnauth: false }
  )
);

// PATCH /admin/pages/:id — update
router.patch(
  "/:id",
  route(
    async ({ params, body, user: adminUser, set, setStatus }) => {
      const idOrSlug = decodeURIComponent(params.id);
      const page = await Page.findOne({
        $or: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      });

      if (!page) {
        setStatus(404);
        set("error", "Page not found");
        return;
      }

      const fields = pick(body, ALLOWED_FIELDS);
      Object.assign(page, fields);
      // Clear wordCount/charCount so pre-save hook recalculates them
      page.wordCount = 0;
      page.charCount = 0;
      await page.save();

      set("ok", true);
      set("page", sanitize(page.toObject()));
    },
    { allowUnauth: false }
  )
);

// DELETE /admin/pages/:id — soft-delete
router.delete(
  "/:id",
  route(
    async ({ params, user: adminUser, set, setStatus }) => {
      const idOrSlug = decodeURIComponent(params.id);
      const page = await Page.findOne({
        $or: [{ id: idOrSlug }, { slug: idOrSlug }],
      });

      if (!page) {
        setStatus(404);
        set("error", "Page not found");
        return;
      }

      if (page.deletedAt) {
        setStatus(409);
        set("error", "Page already deleted");
        return;
      }

      page.deletedAt = new Date();
      page.deletedBy = adminUser.id;
      await page.save();

      set("ok", true);
      set("page", sanitize(page.toObject()));
    },
    { allowUnauth: false }
  )
);

// POST /admin/pages/:id/restore
router.post(
  "/:id/restore",
  route(
    async ({ params, set, setStatus }) => {
      const idOrSlug = decodeURIComponent(params.id);
      const page = await Page.findOne({
        $or: [{ id: idOrSlug }, { slug: idOrSlug }],
      });

      if (!page) {
        setStatus(404);
        set("error", "Page not found");
        return;
      }

      page.deletedAt = null;
      page.deletedBy = null;
      await page.save();

      set("ok", true);
      set("page", sanitize(page.toObject()));
    },
    { allowUnauth: false }
  )
);

export default router;
