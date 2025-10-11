// #methods/visibility/utils.js
/**
 * Escape a string for use inside a RegExp constructor.
 * Example: escapeRegExp("kwln.org") → "kwln\.org"
 */
export function escapeRegExp(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
