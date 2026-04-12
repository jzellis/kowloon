// routes/users/posts.js
// GET /users/:id/posts — Posts by a user, visibility-filtered

import makeCollection from "../utils/makeCollection.js";
import { Post } from "#schema";
import sanitizeObject from "#methods/sanitize/object.js";
import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default makeCollection({
  model: Post,
  buildQuery: (req, { user }) => {
    const userId = decodeURIComponent(req.params.id);
    const domain = getSetting("domain");
    const filter = {
      actorId: userId,
      deletedAt: null,
    };

    // Determine what posts the viewer can see
    let isLocal = false;
    if (user?.id) {
      const parsed = kowloonId(user.id);
      isLocal = parsed.domain && isLocalDomain(parsed.domain);
    }

    if (!user?.id) {
      // Unauthenticated: public only
      filter.to = "@public";
    } else if (user.id === userId) {
      // Own posts: no filter on visibility
    } else if (isLocal) {
      // Local user: public + server posts
      filter.to = { $in: ["@public", `@${domain}`] };
    } else {
      // Remote user: public only
      filter.to = "@public";
    }

    if (req.query.type) filter.type = req.query.type;

    return filter;
  },
  select:
    "id type objectType title summary body url actorId tags image attachments to createdAt updatedAt replyCount reactCount reactPreview",
  sanitize: (doc) => sanitizeObject(doc, { objectType: "Post" }),
});
