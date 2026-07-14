// routes/users/groups.js
// GET /users/:id/groups — List a user's group memberships (groups they belong to).
//
// Owner (viewer === :id) sees ALL their memberships. Other viewers see only
// groups they can see — @public, plus @<domain> and shared circle-scoped groups
// for authed local viewers — the same visibility rule as GET /groups.

import route from "../utils/route.js";
import { Group, Circle, User } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { getViewerContext } from "#methods/visibility/context.js";

export default route(async ({ req, params, query, user, set }) => {
  const userId = decodeURIComponent(params.id);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
  const skip = (page - 1) * limit;

  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const base = `${protocol}://${domain}/users/${encodeURIComponent(userId)}/groups`;

  const setCollection = (orderedItems, totalItems) => {
    const collection = activityStreamsCollection({
      id: `${base}?page=${page}`,
      orderedItems,
      totalItems,
      page,
      itemsPerPage: limit,
      baseUrl: base,
    });
    for (const [key, value] of Object.entries(collection)) set(key, value);
  };

  // Membership source: the user's Groups system-circle — its members are the
  // groups they belong to.
  const target = await User.findOne({ id: userId }).select("circles").lean();
  let groupIds = [];
  if (target?.circles?.groups) {
    const groupsCircle = await Circle.findOne({ id: target.circles.groups })
      .select("members")
      .lean();
    groupIds = (groupsCircle?.members || [])
      .map((m) => m.id)
      .filter((id) => id?.startsWith("group:"));
  }

  if (groupIds.length === 0) return setCollection([], 0);

  const filter = { id: { $in: groupIds }, deletedAt: null };

  // Owner sees all; others see only groups visible to them (mirrors GET /groups).
  const isOwner = !!(user?.id && user.id === userId);
  if (!isOwner) {
    let isLocal = false;
    if (user?.id) {
      const parsed = kowloonId(user.id);
      isLocal = parsed.domain && isLocalDomain(parsed.domain);
    }
    if (!user?.id || !isLocal) {
      filter.to = "@public";
    } else {
      const ctx = await getViewerContext(user.id);
      filter.to = { $in: ["@public", `@${domain}`, ...(ctx?.circleIds || [])] };
    }
  }

  const [docs, total] = await Promise.all([
    Group.find(filter)
      .select(
        "id name description icon image to rsvpPolicy memberCount url createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Group.countDocuments(filter),
  ]);

  setCollection(docs, total);
}, { allowUnauth: true });
