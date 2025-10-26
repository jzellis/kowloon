// routes/_utils/oc.js
export function toInt(v, d) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
}

/**
 * Standard OrderedCollection shape
 */
export function orderedCollection({
  items,
  totalItems,
  page,
  pageSize,
  nextCursor,
}) {
  const totalPages =
    pageSize > 0 ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
  return {
    items,
    count: items.length,
    totalItems,
    currentPage: page,
    totalPages,
    pageSize,
    nextCursor: nextCursor || null,
  };
}
