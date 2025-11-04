import { Feed } from "#schema";

export async function getCircleTimeline(
  viewerId,
  circleId,
  { limit = 50 } = {}
) {
  const filter = { userId: viewerId, deletedAt: null, localCircleId: circleId };
  return Feed.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}
