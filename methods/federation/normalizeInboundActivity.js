// methods/federation/normalizeInboundActivity.js
// Translate a standard ActivityPub activity envelope into our internal format.
//
// Remote servers send AP activities like:
//   { type: "Create", actor: "https://...", object: { type: "Note", ... }, to: [...] }
//
// Our ActivityParser expects:
//   { type: "Create", actorId: "...", objectType: "Post", to: "@public", canReply: "public", ... }

import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";

const AS_PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

// ActivityPub object types → our internal Post type field
const AP_TYPE_TO_POST_TYPE = {
  note:     "Note",
  article:  "Article",
  image:    "Media",
  video:    "Media",
  audio:    "Media",
  document: "Media",
  event:    "Event",
  link:     "Link",
  page:     "Link",
};

// ActivityPub object types → our objectType
const AP_TYPE_TO_OBJECT_TYPE = {
  note:     "Post",
  article:  "Post",
  image:    "Post",
  video:    "Post",
  audio:    "Post",
  document: "Post",
  event:    "Post",
  link:     "Post",
  page:     "Post",
  person:   "User",
  group:    "Group",
  service:  "User",
  tombstone: "Delete",
};

/**
 * Resolve AP `to`/`cc` arrays to our single-string visibility value.
 * Returns one of: "@public" | "@<domain>" | "audience"
 */
function resolveVisibility(to = [], cc = []) {
  const all = [...(Array.isArray(to) ? to : [to]), ...(Array.isArray(cc) ? cc : [cc])].filter(Boolean);
  if (all.includes(AS_PUBLIC)) return "@public";

  const domain = getSetting("domain");
  if (domain && all.some(t => t.includes(domain))) return `@${domain}`;

  return "audience";
}

/**
 * Strip HTML tags and decode entities from AP `content` (which is HTML).
 * Stores raw HTML in source.content with mediaType text/html.
 */
function normalizeContent(obj) {
  if (!obj) return obj;
  const out = { ...obj };

  const html = out.content ?? out.contentMap?.en ?? "";
  if (html) {
    if (!out.source) out.source = {};
    if (!out.source.content) {
      out.source.content = html;
      out.source.mediaType = "text/html";
      out.source.contentEncoding = "utf-8";
    }
  }

  return out;
}

/**
 * Normalize an AP object embedded in Create/Update/Announce.
 */
function normalizeApObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = normalizeContent(obj);

  // Normalize actorId: AP uses attributedTo
  if (!out.actorId && out.attributedTo) {
    out.actorId = typeof out.attributedTo === "string"
      ? out.attributedTo
      : out.attributedTo?.id;
  }

  // Map published/updated to our timestamps
  if (out.published && !out.createdAt) out.createdAt = new Date(out.published);
  if (out.updated && !out.updatedAt)   out.updatedAt = new Date(out.updated);

  // Map url from AP arrays/objects to string
  if (Array.isArray(out.url)) out.url = out.url[0]?.href ?? out.url[0];
  if (out.url && typeof out.url === "object") out.url = out.url.href ?? null;

  // Map AP image to our image field
  if (out.image && typeof out.image === "object") {
    out.image = out.image.url ?? out.image.href ?? null;
  }
  if (Array.isArray(out.attachment)) {
    out.attachments = out.attachment
      .map(a => a?.url ?? a?.href ?? null)
      .filter(Boolean);
    delete out.attachment;
  }

  // AP inReplyTo is an array or string
  if (Array.isArray(out.inReplyTo)) out.inReplyTo = out.inReplyTo[0] ?? null;

  return out;
}

/**
 * Determine if an ID refers to a local resource.
 */
function isLocalId(id) {
  if (!id) return false;
  const domain = getSetting("domain");
  if (!domain) return false;
  try {
    const url = new URL(id);
    return isLocalDomain(url.hostname);
  } catch {
    // Not a URL: check our @handle@domain format
    return id.includes(`@${domain}`) || id.endsWith(`@${domain}`);
  }
}

/**
 * Translate a raw AP activity from a remote server into our internal format.
 * Returns a new object; does not mutate the input.
 */
export default function normalizeInboundActivity(apActivity) {
  if (!apActivity || typeof apActivity !== "object") return apActivity;

  // Quick exit: already in our format (has objectType set, no @context)
  if (apActivity.objectType && !apActivity["@context"]) return apActivity;

  const act = { ...apActivity };

  // --- actorId: AP uses `actor` field (URL string or object) ---
  if (!act.actorId) {
    const actor = act.actor;
    act.actorId = typeof actor === "string" ? actor : actor?.id ?? null;
  }

  // --- objectType: infer from embedded object type or top-level type ---
  if (!act.objectType && act.object && typeof act.object === "object") {
    const apType = (act.object.type ?? "").toLowerCase();
    act.objectType = AP_TYPE_TO_OBJECT_TYPE[apType] ?? null;

    // Also map to our Post `type` subfield if needed
    if (act.objectType === "Post" && !act.object.type?.match(/^(Note|Article|Media|Event|Link)$/)) {
      act.object = { ...act.object, type: AP_TYPE_TO_POST_TYPE[apType] ?? "Note" };
    }
  }

  // For Delete/Tombstone: objectType may just be "Delete"
  if (act.type === "Delete" && !act.objectType) {
    act.objectType = "Delete";
  }

  // --- to / visibility ---
  const rawTo = act.to ?? [];
  const rawCc = act.cc ?? [];
  const vis = resolveVisibility(rawTo, rawCc);

  // Only set if not already set in our format (e.g., "@public")
  if (!act.to || Array.isArray(act.to) || act.to.startsWith("http")) {
    act.to = vis;
  }

  // --- canReply / canReact: default based on visibility ---
  if (act.canReply === undefined) {
    act.canReply = vis === "@public" ? "public" : "audience";
  }
  if (act.canReact === undefined) {
    act.canReact = vis === "@public" ? "public" : "audience";
  }

  // --- Normalize embedded object for Create/Update/Announce ---
  if (act.object && typeof act.object === "object") {
    act.object = normalizeApObject(act.object);
    // Copy visibility down if not set on object
    if (!act.object.to || Array.isArray(act.object.to)) {
      act.object.to = act.to;
    }
    if (!act.object.canReply) act.object.canReply = act.canReply;
    if (!act.object.canReact) act.object.canReact = act.canReact;
  }

  // --- Inbound Follow: normalize object to a local user ID ---
  // AP `object` for Follow is the actor being followed (a URL).
  // If it's one of our local users, keep it as-is; the Follow handler will look them up.
  if (act.type === "Follow" && typeof act.object === "string") {
    // Check if this is an inbound follow (remote follows a local user)
    // vs outbound follow normalization (shouldn't hit this path for outbound)
    act._inboundFollow = isLocalId(act.object);
  }

  // --- Timestamps ---
  if (act.published && !act.publishedAt) act.publishedAt = new Date(act.published);

  // --- Clean up AP-specific fields we've consumed ---
  // Keep @context for downstream use but remove arrays we've normalized
  delete act.cc;

  return act;
}
