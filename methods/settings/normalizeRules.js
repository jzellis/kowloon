// Normalize and render the `rules` setting on save.
//
// Each rule is `{ id, text, html }`:
//   - `text` is the markdown source the admin edited (canonical).
//   - `html` is the sanitized rendered output the frontend reads.
//   - `id` is a stable identifier — generated server-side if missing — so
//     reorders/edits don't invalidate previously-given user consent on
//     unchanged rules.
//
// Invoked by routes/admin/settings.js when saving the `rules` setting.

import crypto from "crypto";
import { marked } from "marked";
import sanitizeHtml from "#methods/utils/sanitize.js";

const RULE_SANITIZE_OPTIONS = {
  allowedTags: [
    "p", "br", "strong", "em", "s", "u", "a",
    "ul", "ol", "li", "code", "blockquote",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
};

function newRuleId() {
  return globalThis.crypto?.randomUUID?.() ?? crypto.randomBytes(16).toString("hex");
}

export default function normalizeRules(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const text = typeof entry.text === "string" ? entry.text.trim() : "";
      if (!text) return null;
      const id = typeof entry.id === "string" && entry.id ? entry.id : newRuleId();
      const html = sanitizeHtml(marked.parse(text, { async: false }), RULE_SANITIZE_OPTIONS);
      return { id, text, html };
    })
    .filter(Boolean);
}
