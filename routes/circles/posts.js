// routes/circles/posts.js
// GET /circles/:id/posts — Primary timeline view (circle-based feed)

import route from "../utils/route.js";
import { Circle } from "#schema";
import getTimeline from "#methods/feed/getTimeline.js";

const VISIBILITY_MAP = { public: 'Public', server: 'Server', audience: 'Audience' };

function parseUsername(actorId) {
  if (!actorId) return null;
  return actorId.replace(/^@/, '').split('@')[0] || null;
}

/**
 * Normalize a raw FeedItems document into the shape frontend components expect.
 * Flattens post content from item.object to the top level.
 */
function normalizeFeedItem(item) {
  const raw = item.toObject ? item.toObject() : { ...item };
  const obj = raw.object ?? {};
  const actor = (obj.actor && Object.keys(obj.actor).length > 0) ? obj.actor : null;

  return {
    // Spread post content fields (body, title, href, tags, event, attachments, etc.)
    ...obj,

    // Top-level identifiers always win
    id: raw.id,
    url: raw.url ?? obj.url,
    objectType: raw.objectType,
    type: raw.type,

    // Author — map actor/actorId → attributedTo (ActivityStreams convention used by frontend)
    attributedTo: {
      id: raw.actorId,
      name: actor?.name ?? parseUsername(raw.actorId),
      icon: actor?.icon ?? null,
      url: actor?.url ?? null,
      server: actor?.server ?? null,
    },

    // Timestamp
    published: raw.publishedAt,
    publishedAt: raw.publishedAt,

    // Visibility string the frontend expects
    visibility: VISIBILITY_MAP[raw.to] ?? 'Public',

    // Capabilities
    canReply: raw.canReply,
    canReact: raw.canReact,
  };
}

export default route(async ({ req, params, query, user, set, setStatus }) => {
  if (!user?.id) {
    setStatus(401);
    set("error", "Authentication required");
    return;
  }

  const circleId = decodeURIComponent(params.id);

  // Verify ownership
  const circle = await Circle.findOne({ id: circleId, deletedAt: null })
    .select("actorId")
    .lean();

  if (!circle) {
    setStatus(404);
    set("error", "Circle not found");
    return;
  }

  if (circle.actorId !== user.id) {
    setStatus(403);
    set("error", "Access denied");
    return;
  }

  const types = query.types
    ? String(query.types).split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const since = query.since || null;
  const limit = Math.min(Number(query.limit) || 50, 500);

  const result = await getTimeline({
    viewerId: user.id,
    circleId,
    types,
    since,
    limit,
  });

  const orderedItems = result.items.map(normalizeFeedItem);

  set("@context", "https://www.w3.org/ns/activitystreams");
  set("type", "OrderedCollection");
  set("totalItems", orderedItems.length);
  set("orderedItems", orderedItems);
  if (result.nextCursor) {
    set("next", result.nextCursor);
  }
});
