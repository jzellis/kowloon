import { toGeoPoint } from "./geo.js";

// Coerce a profile object into your Profile subschema
export function toProfile(input) {
  if (!input) return undefined;
  const { name, subtitle, description, urls, pronouns, icon, location } = input;
  const out = {
    ...(name ? { name } : {}),
    ...(subtitle ? { subtitle } : {}),
    ...(description ? { description } : {}),
    ...(Array.isArray(urls) ? { urls } : {}),
    ...(pronouns ? { pronouns } : {}),
    ...(icon ? { icon } : {}),
  };
  const loc = toGeoPoint(location);
  if (loc) out.location = loc;
  return Object.keys(out).length ? out : undefined;
}
