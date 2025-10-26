// routes/activities/index.js
import Activity from "#schema/Activity.js"; // or wherever your model is
import { orderedCollection, toInt } from "../utils/oc.js";
import route from "../utils/route.js"; // your wrapper

export default route(async ({ query, set, setStatus }) => {
  // read paging params (support both page + pageSize, default to 0/20)
  const page = toInt(query.page, 0);
  const pageSize = Math.min(toInt(query.pageSize, 20), 100);

  // your existing filter (adjust as needed)
  const filter = {}; // e.g. visibility, actorId, etc.

  // compute totals
  const totalItems = await Activity.countDocuments(filter);

  // page slice (keep your sort)
  const sort = { createdAt: -1 };
  const items = await Activity.find(filter)
    .sort(sort)
    .skip(page * pageSize)
    .limit(pageSize)
    .lean();

  // optional: also keep your cursor if you want both styles
  const nextCursor = items.length
    ? items[items.length - 1].createdAt.toISOString()
    : null;

  const oc = orderedCollection({
    items,
    totalItems,
    page,
    pageSize,
    nextCursor,
  });

  set("ok", true);
  setStatus(200);
  set("items", oc.items);
  set("count", oc.count);
  set("totalItems", oc.totalItems);
  set("currentPage", oc.currentPage);
  set("totalPages", oc.totalPages);
  set("pageSize", oc.pageSize);
  set("nextCursor", oc.nextCursor); // optional
});
