// routes/admin/settings.js
import express from "express";
import route from "../utils/route.js";
import { Settings } from "#schema";
import { setSetting, getAllSettings } from "#methods/settings/cache.js";

const router = express.Router({ mergeParams: true });

// Fields that cannot be updated via the API (managed by the server itself).
// Any setting with ui.type === "redacted" is also treated as read-only at runtime.
const READONLY_FIELDS = new Set(["privateKey", "publicKey", "publicKeyJwk"]);

function isReadonly(doc) {
  return READONLY_FIELDS.has(doc?.name) || doc?.ui?.type === "redacted";
}

function sanitizeSetting(doc) {
  // Never expose the private key value
  if (doc.name === "privateKey") {
    return { ...doc, value: "[redacted]" };
  }
  return doc;
}

// GET /admin/settings — list all settings
router.get(
  "/",
  route(
    async ({ set }) => {
      const docs = await Settings.find({ deletedAt: null }).lean();
      const settings = docs.map(({ _id, __v, ...rest }) => sanitizeSetting(rest));
      set("settings", settings);
      set("total", settings.length);
    },
    { allowUnauth: false }
  )
);

// PATCH /admin/settings — bulk update (body: { name: value, ... })
router.patch(
  "/",
  route(
    async ({ body, set, setStatus }) => {
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        setStatus(400);
        set("error", "Body must be an object of { settingName: value }");
        return;
      }

      // Load current docs to check ui.type === "redacted" as well
      const existingDocs = await Settings.find({ name: { $in: Object.keys(body) } }).lean();
      const existingMap = Object.fromEntries(existingDocs.map((d) => [d.name, d]));
      const blocked = Object.keys(body).filter((k) => READONLY_FIELDS.has(k) || isReadonly(existingMap[k]));
      if (blocked.length > 0) {
        setStatus(403);
        set("error", `Cannot update read-only settings: ${blocked.join(", ")}`);
        return;
      }

      const updated = [];
      for (const [name, value] of Object.entries(body)) {
        await Settings.findOneAndUpdate(
          { name },
          { $set: { name, value } },
          { upsert: true, new: true }
        );
        setSetting(name, value); // update in-memory cache
        updated.push(name);
      }

      set("ok", true);
      set("updated", updated);
    },
    { allowUnauth: false }
  )
);

// PATCH /admin/settings/:name — update a single setting
router.patch(
  "/:name",
  route(
    async ({ params, body, set, setStatus }) => {
      const { name } = params;

      const existing = await Settings.findOne({ name }).lean();
      if (READONLY_FIELDS.has(name) || isReadonly(existing)) {
        setStatus(403);
        set("error", `Cannot update read-only setting: ${name}`);
        return;
      }

      if (!("value" in body)) {
        setStatus(400);
        set("error", "Body must include a 'value' field");
        return;
      }

      const doc = await Settings.findOneAndUpdate(
        { name },
        { $set: { name, value: body.value } },
        { upsert: true, new: true }
      ).lean();

      setSetting(name, body.value); // update in-memory cache

      const { _id, __v, ...rest } = doc;
      set("ok", true);
      set("setting", sanitizeSetting(rest));
    },
    { allowUnauth: false }
  )
);

export default router;
