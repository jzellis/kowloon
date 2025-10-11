// Uses your Post schema; lets pre('save') mint id: post:<_id>@<domain>
import { toGeoPoint } from "#ActivityParser/_subdocs/geo.js";

function asAddrString(v) {
  if (v == null) return undefined;
  return Array.isArray(v) ? v.join(" ") : String(v);
}

export default async function handleCreatePost(activity, ctx) {
  const { Post } = ctx.db || {};
  if (!Post) throw new Error("Create/Post: Post model not available");
  const payload = activity.object;
  if (!payload) throw new Error("Create/Post requires activity.object");

  const doc = new Post({
    // Core content (copy only fields your Post schema supports)
    url: payload.url,
    href: payload.href,
    title: payload.title,
    summary: payload.summary,
    body: payload.body,
    image: payload.image,
    attachments: payload.attachments,
    tags: payload.tags,
    type: payload.type, // your schema permits "Note" / others

    // GeoPoint (normalized): { type:"Point", coordinates:[lng,lat], name? }
    location: toGeoPoint(payload.location), // matches your GeoPoint subschema.  [oai_citation:3‡GeoPoint.js](file-service://file-4tRsznYvbHA13HRMhvzKRX)

    // Actor/server
    actorId: activity.actorId, // full @user@domain
    actor: payload.actor, // if you store an embedded actor blob
    server: ctx.domain ?? payload.server,

    // Optional destination context
    group: payload.group,
    target: activity.target ?? payload.target,

    // Addressing (strings in your schema)
    to: asAddrString(activity.to ?? payload.to),
    replyTo: asAddrString(activity.replyTo ?? payload.replyTo),
    reactTo: asAddrString(activity.reactTo ?? payload.reactTo),

    // Source content snapshot
    "source.content": payload?.source?.content ?? "",
    "source.mediaType": payload?.source?.mediaType ?? "text/html",
    "source.contentEncoding": payload?.source?.contentEncoding ?? "utf-8",
  });

  await doc.save(); // pre('save') assigns post:<_id>@<domain>

  activity.object = { id: doc.id, type: "Post" };

  return {
    createdObjects: [doc.toObject()],
    sideEffects: ["create:post"],
  };
}
