import { TimelineEntry } from "#schema";

// item: the object returned by remote/local feed (already ACL-filtered by author server)
// scope: "public" | "server" | "circle"
// reason: "follow" | "domain" | "mention" | "self"
export default async function upsertTimelineEntry({
  viewerId,
  item,
  scope,
  reason,
  localCircleId,
}) {
  const entry = {
    userId: viewerId,
    objectType: item.type, // "Post" etc.
    objectId: item.id, // "post:uuid@..."
    createdAt: new Date(item.createdAt || item.published || Date.now()),
    reason,
    scope,
    localCircleId, // optional; internal only
    originDomain: item.id.split("@").pop(),
    snapshot: buildSnapshot(item, scope),
    fetchedAt: new Date(),
    deletedAt: null,
  };

  await TimelineEntry.findOneAndUpdate(
    { userId: viewerId, objectId: item.id },
    { $set: entry },
    { upsert: true }
  );
}

function buildSnapshot(item, scope) {
  // keep it minimal; never include circle identifiers or private fields
  return {
    id: item.id,
    actorId: item.actorId,
    title: item.title,
    body: item.body, // consider truncation/HTML render if needed
    media: item.media || [],
    visibility: item.visibility || scope,
    summary: item.summary,
  };
}
