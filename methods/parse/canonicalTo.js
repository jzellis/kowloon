// canonicalTo — normalize an addressing value to Kowloon's canonical scheme.
//
// Canonical `to` (and canReply / canReact) values on SOURCE objects (Post,
// Circle, Group, User, File):
//   @public                — public
//   @<domain>              — server-only
//   circle:<id>@<domain>   — a circle
//   group:<id>@<domain>    — a group
//   @<owner>@<domain>      — private (a single user)
//
// This is CONSERVATIVE: it coerces only clearly-loose synonyms ("", "public",
// "server", "true") and preserves anything already id-shaped (starts with "@"
// or "circle:"/"group:"), so a private/circle/group address is never widened to
// public by accident. Malformed ids (e.g. a handle with a space) are left as-is
// for a targeted fix, not silently made public.
//
// NOTE: do NOT use this on FeedItems.to — that field is intentionally a coarse
// enum (public/server/audience) and must not carry circle/group ids.

import { getSetting } from "#methods/settings/cache.js";

export function canonicalTo(value, { default: fallback = "@public", domain } = {}) {
  const d = (domain || getSetting("domain") || "").toLowerCase();
  const v = typeof value === "string" ? value.trim() : "";
  const low = v.toLowerCase();

  if (v === "") return fallback; // empty → the caller's default

  // Loose synonyms → canonical.
  if (low === "public" || low === "@public") return "@public";
  if (low === "server" || low === "@server") return d ? `@${d}` : "@public";
  if (d && low === d) return `@${d}`; // bare "kwln.social" → "@kwln.social"
  if (low === "true" || low === "false") return fallback; // boolean garbage

  // Already id-shaped — preserve exactly (incl. malformed @user@domain, handled
  // separately): @public, @<domain>, @<user>@<domain>, circle:…, group:…
  if (v.startsWith("@") || v.startsWith("circle:") || v.startsWith("group:")) {
    return v;
  }

  // Unknown non-address string → fallback.
  return fallback;
}

// Normalize an object's { to, canReply, canReact } together. canReply/canReact
// inherit the (already-normalized) `to` when blank — a reply/react audience
// should default to matching the post's visibility, not be forced to public.
// `ownerId` is the fallback for a blank `to` on owner-scoped objects (Circles).
export function canonicalAudience({ to, canReply, canReact }, { domain, toFallback = "@public" } = {}) {
  const nTo = canonicalTo(to, { default: toFallback, domain });
  return {
    to: nTo,
    canReply: canReply === undefined ? undefined : canonicalTo(canReply, { default: nTo, domain }),
    canReact: canReact === undefined ? undefined : canonicalTo(canReact, { default: nTo, domain }),
  };
}
