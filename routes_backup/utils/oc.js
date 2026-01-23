// routes/_utils/oc.js
export function toInt(v, d) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
}

/**
 * Standard OrderedCollection shape (legacy format)
 */
export function orderedCollection({
  items,
  totalItems,
  page,
  pageSize,
  nextCursor,
}) {
  // const totalPages =
  //   pageSize > 0 ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
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

/**
 * ActivityStreams OrderedCollection or OrderedCollectionPage format
 *
 * @param {Object} options
 * @param {string} options.id - Full URL of this collection/page
 * @param {Array} options.orderedItems - The items in the collection
 * @param {number} options.totalItems - Total number of items across all pages
 * @param {number} [options.page] - Current page number (1-indexed). If provided, returns OrderedCollectionPage
 * @param {number} [options.itemsPerPage] - Items per page for pagination
 * @param {string} [options.baseUrl] - Base URL without page param (for building first/last/next/prev)
 * @returns {Object} ActivityStreams OrderedCollection or OrderedCollectionPage
 */
export function activityStreamsCollection({
  id,
  orderedItems,
  totalItems,
  page,
  itemsPerPage,
  baseUrl,
}) {
  const totalPages =
    itemsPerPage > 0 ? Math.max(1, Math.ceil(totalItems / itemsPerPage)) : 1;

  // Helper to build page URLs
  const pageUrl = (pageNum) => {
    if (!baseUrl) return null;
    const url = new URL(baseUrl);
    url.searchParams.set("page", pageNum);
    return url.toString();
  };

  // If no page specified or page=1 without itemsPerPage, return root OrderedCollection
  if (!page || (page === 1 && !itemsPerPage)) {
    const collection = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      id,
      totalItems,
    };

    // Add first/last links if paginated
    if (itemsPerPage && baseUrl) {
      collection.first = pageUrl(1);
      if (totalPages > 1) {
        collection.last = pageUrl(totalPages);
      }
    }

    // If we have items and no pagination, include them directly
    if (orderedItems && orderedItems.length > 0 && !itemsPerPage) {
      collection.orderedItems = orderedItems;
    }

    return collection;
  }

  // Return OrderedCollectionPage for paginated results
  const collectionPage = {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollectionPage",
    id: pageUrl(page) || id,
    partOf: baseUrl || id,
    orderedItems,
    totalPages, // const totalPages =
    //   pageSize > 0 ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
    totalItems,
    currentPage: page,
  };

  // Add next link if not on last page
  if (page < totalPages && baseUrl) {
    collectionPage.next = pageUrl(page + 1);
  }

  // Add prev link if not on first page
  if (page > 1 && baseUrl) {
    collectionPage.prev = pageUrl(page - 1);
  }

  return collectionPage;
}
