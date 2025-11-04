import { Feed } from "#schema";

export default async function getTimeline(
  viewerId,
  { limit = 50, before } = {}
) {
  const filter = { userId: viewerId, deletedAt: null };

  // If a cursor (`before`) was provided, fetch items created before that timestamp
  if (before) filter.createdAt = { $lt: new Date(before) };

  // Retrieve timeline entries
  const rows = await Feed.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Optional cursor for pagination (ISO string for easy reuse)
  const nextCursor = rows.length
    ? rows[rows.length - 1].createdAt.toISOString()
    : null;
  const hasMore = rows.length === limit;
  // Return both items and cursor
  return {
    items: rows,
    nextCursor,
    hasMore,
  };
}
