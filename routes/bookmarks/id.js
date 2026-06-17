// routes/bookmarks/id.js
// GET /bookmarks/:id — Single bookmark or folder by ID. Visibility respects
// the folder chain: even an @public bookmark inside a private folder is
// hidden from non-owners.

import makeGetById from "../utils/makeGetById.js";
import { getViewerContext } from "#methods/visibility/context.js";
import { canSeeBookmark } from "#methods/bookmarks/visibility.js";

export default makeGetById({
  mode: "local",
  canView: async (viewerId, doc) => {
    const ctx = await getViewerContext(viewerId);
    return canSeeBookmark(doc, ctx);
  },
});
