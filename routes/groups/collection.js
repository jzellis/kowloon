// /routes/groups/collection.js
import route from "../utils/route.js";
import { Group } from "#schema";

/**
 * GET /groups
 * Lists discoverable groups. Returns an OrderedCollection-like payload:
 *  - totalItems, totalPages, currentPage, count, firstItem, lastItem, items[]
 * Query:
 *  - page (default 1)
 *  - itemsPerPage (default 50, max 200)
 *  - q (optional text search; name/description)
 */
export default route(async ({ query, set }) => {
  const page = Math.max(1, Number(query.page || 1));
  const itemsPerPage = Math.max(
    1,
    Math.min(200, Number(query.itemsPerPage || 50))
  );
  const q = (query.q || "").toString().trim();

  // Only list discoverable groups; start with @public for now.
  // (You can extend this with server-scoped visibility if desired.)
  const filter = { deletedAt: null, to: "@public" };

  // Optional naive text search
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }

  const totalItems = await Group.countDocuments(filter);
  const docs = await Group.find(filter)
    .sort({ updatedAt: -1, _id: 1 })
    .skip((page - 1) * itemsPerPage)
    .limit(itemsPerPage)
    .lean();

  const items = docs.map((g) => ({
    id: g.id,
    type: "Group",
    name: g.name,
    summary: g.description,
    icon: g.icon,
    url: g.url,
    to: g.to,
    replyTo: g.replyTo,
    reactTo: g.reactTo,
    updatedAt: g.updatedAt,
  }));

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  set("totalItems", totalItems);
  set("totalPages", totalPages);
  set("currentPage", page);
  set("count", items.length);
  if (items.length) {
    set("firstItem", items[0].id);
    set("lastItem", items[items.length - 1].id);
  }
  set("items", items);
});
