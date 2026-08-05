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

  const memberCircles = await Circle.find({
    "members.id": viewerId,
    deletedAt: null,
  })
    .select("id")
    .lean();
  const memberCircleIds = memberCircles.map((c) => c.id);

  // A Group's members-circle id lives at `circles.members` (there is no
  // top-level `members` field) — querying `members` matched nothing, so
  // groupIds was always empty and group-addressed posts fetched by id 403'd
  // even for members.
  const groups = memberCircleIds.length
    ? await Group.find({ "circles.members": { $in: memberCircleIds }, deletedAt: null })
        .select("id")
        .lean()
    : [];
  const groupIds = new Set(groups.map((g) => g.id));

  const viewer = await User.findOne({ id: viewerId }).select("blocked").lean();
  let blockedActorIds = new Set();
  if (viewer?.blocked) {
    const blockedCircle = await Circle.findOne({ id: viewer.blocked })
      .select("members.id")
      .lean();
    blockedActorIds = new Set((blockedCircle?.members ?? []).map((m) => m.id));
  }

  return {
    isAuthenticated: true,
    viewerId,
    viewerDomain,
    circleIds: new Set(memberCircleIds),
    groupIds,
    blockedActorIds,
  };
}
