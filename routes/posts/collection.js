// routes/posts/collection.js
// GET /posts — Public firehose: all posts with to:"@public"
// Resolves File IDs in `image` and `attachments` to full file objects for display.

import route from "../utils/route.js";
import { Post, File } from "#schema";
import sanitizeObject from "#methods/sanitize/object.js";

const SELECT =
  "id type objectType title summary body url href actorId actor tags image attachments to createdAt updatedAt replyCount reactCount shareCount";

export default route(async ({ req, query, set }) => {
  const filter = {
    to: "@public",
    deletedAt: null,
  };
  if (query.type) filter.type = query.type;
  if (query.since) filter.createdAt = { $gte: new Date(query.since) };
  if (query.serverId) filter.server = query.serverId;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    Post.find(filter).select(SELECT).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments(filter),
  ]);

  // Collect all File IDs used in `image` or `attachments` across all docs
  const fileIds = new Set();
  for (const doc of docs) {
    if (doc.image && doc.image.startsWith("file:")) fileIds.add(doc.image);
    for (const id of doc.attachments ?? []) {
      if (id && id.startsWith("file:")) fileIds.add(id);
    }
  }

  // Fetch all needed file records in one query
  const fileMap = new Map();
  if (fileIds.size > 0) {
    const files = await File.find({ id: { $in: [...fileIds] } })
      .select("id url mediaType name summary")
      .lean();
    for (const f of files) fileMap.set(f.id, f);
  }

  const items = docs.map((doc) => {
    const item = sanitizeObject(doc, { objectType: "Post" });

    // Resolve featured image: keep raw ID but add resolved URL as featuredImage
    if (item.image) {
      if (item.image.startsWith("file:") && fileMap.has(item.image)) {
        item.featuredImage = fileMap.get(item.image).url;
      } else if (item.image.startsWith("http")) {
        item.featuredImage = item.image;
      }
    }

    // Resolve attachments: replace File ID strings with {url, mediaType, name} objects
    if (item.attachments?.length) {
      item.attachments = item.attachments
        .map((id) => {
          if (!id) return null;
          const f = fileMap.get(id);
          if (f) return { url: f.url, mediaType: f.mediaType ?? "", name: f.name ?? f.summary ?? "" };
          if (id.startsWith("http")) return { url: id, mediaType: "", name: "" };
          return null;
        })
        .filter(Boolean);
    }

    return item;
  });

  set("@context", "https://www.w3.org/ns/activitystreams");
  set("type", "OrderedCollection");
  set("totalItems", total);
  set("orderedItems", items);
  set("page", page);
  set("itemsPerPage", limit);
});
