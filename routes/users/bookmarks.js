// routes/users/bookmarks.js
// GET /users/:id/bookmarks — A user's bookmarks, viewer-scoped and folder-aware.
//
// Owner sees everything they own. Other viewers get items that pass the
// standard buildVisibilityQuery AND whose ancestor folder chain is also
// visible. Three query modes via ?parentFolder:
//   - omitted              → flat-all for owner; root-only for non-owner
//   - "root"               → root-only (parentFolder missing) for everyone
//   - "<folderId>"         → that folder's direct children, ancestor-checked

import route from "../utils/route.js";
import { Bookmark } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getViewerContext } from "#methods/visibility/context.js";
import { buildVisibilityQuery } from "#methods/visibility/filter.js";
import { canSeeFolderChain } from "#methods/bookmarks/visibility.js";
import { getSetting } from "#methods/settings/cache.js";

const SELECT =
  "id type title summary href target image tags to parentFolder actorId url body createdAt updatedAt";

export default route(async ({ req, params, query, user, set, setStatus }) => {
  const userId = decodeURIComponent(params.id);
  const viewerId = user?.id || null;
  const isOwner = !!viewerId && viewerId === userId;
  const ctx = await getViewerContext(viewerId);

  const parentFolder = query.parentFolder;
  const wantsFolderContents = parentFolder && parentFolder !== "root";

  // Walking *into* a folder requires the whole ancestor chain to be visible —
  // otherwise we'd leak children that nominally have a wider `to`. Owner
  // skips this since they can always see their own folders.
  if (wantsFolderContents && !isOwner) {
    const visible = await canSeeFolderChain(parentFolder, ctx);
    if (!visible) {
      setStatus(404);
      set("error", "Not found");
      return;
    }
  }

  const visibilityFilter = isOwner ? { deletedAt: null } : buildVisibilityQuery(ctx);

  const scoping = { actorId: userId, deletedAt: null };
  if (query.type) scoping.type = query.type;
  if (wantsFolderContents) {
    scoping.parentFolder = parentFolder;
  } else if (parentFolder === "root" || !isOwner) {
    // Explicit root request OR a non-owner — never leak descendants here.
    scoping.parentFolder = { $in: [null, undefined] };
  }
  // else: owner with parentFolder omitted → flat-all (no parentFolder clause)

  const filter = { $and: [visibilityFilter, scoping] };

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    Bookmark.find(filter)
      .select(SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Bookmark.countDocuments(filter),
  ]);

  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const base = `${protocol}://${domain}${req.baseUrl}`;

  const collection = activityStreamsCollection({
    id: `${base}?page=${page}`,
    orderedItems: docs,
    totalItems: total,
    page,
    itemsPerPage: limit,
    baseUrl: base,
  });

  for (const [k, v] of Object.entries(collection)) set(k, v);
});
