// Drop-in replacement for sanitize-html that hardens the `nonTextTags`
// default so disallowed `<xmp>` elements can't leak raw script content
// into the output (CVE-2026-44990, GHSA-rpr9-rxv7-x643).
//
// sanitize-html's default nonTextTags is ['script', 'style', 'textarea',
// 'option']. The `<xmp>` tag — a deprecated HTML2 raw-text container —
// is treated as a disallowed tag, but the library's ontext handler
// special-cases xmp and dumps its contents into the output unescaped.
// Listing 'xmp' under nonTextTags makes it drop-entire-contents instead.
//
// Always import sanitize-html through this module. Callers can extend
// nonTextTags but can't remove 'xmp'.

import sanitizeHtml from "sanitize-html";

const REQUIRED_NON_TEXT_TAGS = ["xmp"];
const DEFAULT_NON_TEXT_TAGS = ["script", "style", "textarea", "option"];

export default function safeSanitizeHtml(html, options = {}) {
  const callerTags = options.nonTextTags ?? DEFAULT_NON_TEXT_TAGS;
  const merged = [...callerTags];
  for (const tag of REQUIRED_NON_TEXT_TAGS) {
    if (!merged.includes(tag)) merged.push(tag);
  }
  return sanitizeHtml(html, { ...options, nonTextTags: merged });
}
