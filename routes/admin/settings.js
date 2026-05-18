// routes/admin/settings.js
import express from "express";
import sanitizeHtml from "#methods/utils/sanitize.js";
import route from "../utils/route.js";
import { Settings } from "#schema";
import { setSetting, getAllSettings } from "#methods/settings/cache.js";

const router = express.Router({ mergeParams: true });

// canEdit: "@private" means the server manages this field — no API writes allowed.
// ui.type === "redacted" also blocks writes (belt and suspenders).
function isReadonly(doc) {
  return doc?.canEdit === "@private" || doc?.ui?.type === "redacted";
}

function sanitizeSetting(doc) {
  // Never expose @private settings' values
  if (doc?.to === "@private" || doc?.name === "privateKey") {
    return { ...doc, value: "[redacted]" };
  }
  return doc;
}

// Settings whose values include HTML fields rendered by clients.
// Map: setting name → list of nested field names to sanitize.
const HTML_FIELDS_BY_SETTING = {
  profile: ["description"],
};

const SANITIZE_OPTIONS = {
  allowedTags: [
    "p", "br", "strong", "em", "s", "u", "a", "ul", "ol", "li",
    "blockquote", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6",
    "hr", "img",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "title"],
    code: ["class"],
    pre: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
};

function sanitizeIncomingValue(name, value) {
  const fields = HTML_FIELDS_BY_SETTING[name];
  if (!fields || !value || typeof value !== "object") return value;
  const out = { ...value };
  for (const field of fields) {
    if (typeof out[field] === "string") {
      out[field] = sanitizeHtml(out[field], SANITIZE_OPTIONS);
    }
  }
  return out;
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
      const blocked = Object.keys(body).filter((k) => isReadonly(existingMap[k]));
      if (blocked.length > 0) {
        setStatus(403);
        set("error", `Cannot update read-only settings: ${blocked.join(", ")}`);
        return;
      }

      const updated = [];
      for (const [name, rawValue] of Object.entries(body)) {
        const value = sanitizeIncomingValue(name, rawValue);
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
      if (isReadonly(existing)) {
        setStatus(403);
        set("error", `Cannot update read-only setting: ${name}`);
        return;
      }

      if (!("value" in body)) {
        setStatus(400);
        set("error", "Body must include a 'value' field");
        return;
      }

      const value = sanitizeIncomingValue(name, body.value);
      const doc = await Settings.findOneAndUpdate(
        { name },
        { $set: { name, value } },
        { upsert: true, new: true }
      ).lean();

      setSetting(name, value); // update in-memory cache

      const { _id, __v, ...rest } = doc;
      set("ok", true);
      set("setting", sanitizeSetting(rest));
    },
    { allowUnauth: false }
  )
);

export default router;
