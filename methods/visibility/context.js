// #methods/visibility/context.js
import { Circle, Group, User } from "#schema";

export function domainOf(userId) {
  return typeof userId === "string" ? userId.split("@").pop() : undefined;
}

export async function getViewerContext(viewerId) {
  if (!viewerId) {
    return {
      isAuthenticated: false,
      viewerId: null,
      viewerDomain: null,
      circleIds: new Set(),
      groupIds: new Set(),
      blockedActorIds: new Set(),
    };
  }

  const viewerDomain = domainOf(viewerId);

  // Query by subdoc membership
  const [circleRows, groupRows, viewer] = await Promise.all([
    Circle.find({ "members.id": viewerId, deletedAt: null })
      .select("id")
      .lean(),
    Group.find({ "members.id": viewerId, deletedAt: null }).select("id").lean(),
    User.findOne({ id: viewerId }).select("blocked").lean(),
  ]);

  return {
    isAuthenticated: true,
    viewerId,
    viewerDomain,
    circleIds: new Set(circleRows.map((c) => c.id)),
    groupIds: new Set(groupRows.map((g) => g.id)),
    blockedActorIds: new Set(viewer?.blocked || []),
  };
}
