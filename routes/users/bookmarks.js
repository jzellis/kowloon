// routes/users/bookmarks.js
// GET /users/:id/bookmarks — User's bookmarks

import makeCollection from "../utils/makeCollection.js";
import { Bookmark } from "#schema";

export default makeCollection({
  model: Bookmark,
  buildQuery: (req, { user }) => {
    const userId = decodeURIComponent(req.params.id);
    const filter = {
      actorId: userId,
      deletedAt: null,
    };

    // Owner sees all, others see only public
    if (!user?.id || user.id !== userId) {
      filter.to = "@public";
    }

    // Optional type filter (Bookmark or Folder)
    if (req.query.type) {
      filter.type = req.query.type;
    }

    // Optional parent folder filter ('root' = top-level items only)
    if (req.query.parentFolder === 'root') {
      filter.parentFolder = { $exists: false };
    } else if (req.query.parentFolder) {
      filter.parentFolder = req.query.parentFolder;
    }

    return filter;
  },
  select:
    "id type title summary href target image tags to parentFolder actorId url body createdAt updatedAt",
});
