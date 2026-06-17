// routes/bookmarks/collection.js
// GET /bookmarks — Root-level bookmarks across all users, viewer-scoped.
// Returns only top-level items (parentFolder unset) so folder-visibility
// inheritance can't be bypassed through this endpoint. Walk into specific
// folders via GET /users/:id/bookmarks?parentFolder=<id>.

import makeCollection from "../utils/makeCollection.js";
import { Bookmark } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";
import { buildVisibilityQuery } from "#methods/visibility/filter.js";

export default makeCollection({
  model: Bookmark,
  buildQuery: async (req, { user }) => {
    const ctx = await getViewerContext(user?.id || null);
    return {
      $and: [
        buildVisibilityQuery(ctx),
        { parentFolder: { $in: [null, undefined] } },
      ],
    };
  },
  select:
    "id type title summary href target image tags to parentFolder actorId url createdAt updatedAt",
});
