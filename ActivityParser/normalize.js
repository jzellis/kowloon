import validateActivity from "./validate.js";

function toArray(v) {
  if (v == null) return undefined;
  return Array.isArray(v) ? v : [v];
}
function deriveVisibility(a) {
  const PUB = "https://www.w3.org/ns/activitystreams#Public";
  const list = [...(a.to || []), ...(a.cc || []), ...(a.audience || [])];
  return list.includes(PUB) ? "public" : "scoped";
}
function normalizeActorId(actor, domain) {
  if (typeof actor === "string" && actor.includes("@")) return actor; // @user@dom or @dom
  try {
    const u = new URL(actor); // https://dom/users/<idOrHandle>
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last && u.hostname) return `${last}@${u.hostname}`;
  } catch {}
  return actor;
}

export default async function normalize(input, ctx) {
  // shallow copy
  const a = { ...input };

  // timestamps
  if (!a.published) a.published = new Date().toISOString();

  // actor → full id (never bare username)
  if (typeof a.actor === "object" && a.actor?.id) a.actor = a.actor.id;
  a.actorId = normalizeActorId(a.actor, ctx.domain);

  // addressing arrays
  a.to = toArray(a.to);
  a.cc = toArray(a.cc);
  a.bto = toArray(a.bto);
  a.bcc = toArray(a.bcc);
  a.audience = toArray(a.audience);
  a.visibility = deriveVisibility(a);

  // per-user inbox context
  if (ctx.targetUserId) a._targetUserId = ctx.targetUserId;

  // 👉 Strict schema validation for verb contracts
  validateActivity(a);

  // DO NOT mint IDs here; let Mongoose pre('save') hooks set: "<type>:<_id>@<domain>"
  return a;
}
