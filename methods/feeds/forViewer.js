// methods/feeds/forViewer.js
import { Post, Reply, Event, User, Follow, Circle } from "#schema";

/**
 * Build a Mongo filter for items the viewer can see from a specific author.
 * Visibility rules:
 * - public: always visible
 * - circle: visible only if viewer follows author AND viewer is a member of the addressed circle
 * - server: (author-local only); since the viewer is remote here, exclude
 */
async function buildVisibilityFilter({ authorId, viewerId }) {
  // Quick exits
  if (!authorId || !viewerId) throw new Error("authorId and viewerId required");

  // 1) PUBLIC is always included
  const or = [{ visibility: "public" }];

  // 2) CIRCLE: allowed only if viewer follows author AND is member of the addressed circle
  // Does viewer follow author?
  const follows = await Follow.exists({
    followerId: viewerId,
    followeeId: authorId,
  });

  if (follows) {
    // Find circle ids (local to the author) that include the viewer
    const viewerCircles = await Circle.find({
      ownerId: authorId,
      members: viewerId,
      deletedAt: null,
    })
      .select("id")
      .lean();

    const allowedCircleIds = viewerCircles.map((c) => c.id);
    if (allowedCircleIds.length) {
      // 'to' stores the audience identifier (your model: circle ids)
      or.push({ visibility: "circle", to: { $in: allowedCircleIds } });
    }
  }

  // 3) SERVER visibility (only-visible-to-author-server members)
  // Viewer is remote in this endpoint, so do NOT include server-only
  // (If you later support same-server viewers over s2s, gate on domain match.)

  return {
    actorId: authorId,
    deletedAt: null,
    $or: or,
  };
}

/**
 * Fetch items of multiple types; merge/sort by createdAt.
 * You can trim to only Post to start if you prefer.
 */
async function fetchAuthorItems(
  filter,
  { since, page, itemsPerPage = 20, select, sort }
) {
  const q = { ...filter };
  if (since) q.createdAt = { $lt: new Date(since) }; // keyset pagination by time

  const projection =
    select || " -deletedAt -deletedBy -_id -__v -source -signature";
  const order = sort || { createdAt: -1 };

  // Pull each collection you want included
  const [posts, replies, events] = await Promise.all([
    Post.find(q).select(projection).sort(order).lean(),
    Reply.find(q).select(projection).sort(order).lean(),
    Event.find(q).select(projection).sort(order).lean(),
  ]);

  // Merge & sort in-memory (createdAt desc)
  let items = [...posts, ...replies, ...events].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  // Paging: page+itemsPerPage OR since+limit style. Choose one.
  if (typeof page === "number") {
    const p = Math.max(1, Math.floor(page));
    const start = (p - 1) * itemsPerPage;
    items = items.slice(start, start + itemsPerPage);
  } else if (typeof itemsPerPage === "number" && itemsPerPage > 0) {
    items = items.slice(0, itemsPerPage);
  }

  const nextCursor = items.length
    ? items[items.length - 1].createdAt?.toISOString()
    : null;

  return { items, nextCursor };
}

/**
 * Main function: list items visible to a viewer from a given author.
 */
export async function listVisibleForViewer({
  authorId,
  viewerId,
  since,
  page,
  itemsPerPage,
}) {
  // sanity
  const author = await User.findOne({ id: authorId }).select("id").lean();
  if (!author) return { items: [], nextCursor: null };

  const filter = await buildVisibilityFilter({ authorId, viewerId });

  const { items, nextCursor } = await fetchAuthorItems(filter, {
    since,
    page,
    itemsPerPage,
  });

  // Wrap as OrderedCollection (your API spec)
  return {
    totalItems: undefined, // you can omit or compute if you need it
    currentPage: page || undefined,
    count: items.length,
    items,
    nextCursor, // cursor-style pagination
  };
}

export default listVisibleForViewer;
