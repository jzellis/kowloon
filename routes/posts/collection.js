// routes/posts/collection.js
// GET /posts — Public firehose: all posts with to:"@public"

import makeCollection from "../utils/makeCollection.js";
import { Post } from "#schema";
import sanitizeObject from "#methods/sanitize/object.js";

export default makeCollection({
  model: Post,
  buildQuery: (_req, { query }) => {
    const filter = {
      to: "@public",
      deletedAt: null,
    };
    if (query.type) filter.type = query.type;
    if (query.since) filter.createdAt = { $gte: new Date(query.since) };
    if (query.serverId) filter.server = query.serverId;
    return filter;
  },
  select:
    "id type objectType title summary body url actorId actor tags image attachments to createdAt updatedAt replyCount reactCount shareCount",
  sanitize: (doc) => sanitizeObject(doc, { objectType: "Post" }),
});
