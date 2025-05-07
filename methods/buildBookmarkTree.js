// Builds a tree structure from a list of bookmarks, organizing them into folders and bookmarks. Generated with ChatGPT because I was too lazy to bother writing my own.

export default function (bookmarks) {
  const map = new Map();
  const tree = [];

  // Initialize map with each bookmark and prepare a items array
  bookmarks.forEach((bookmark) => {
    map.set(bookmark.id, { ...bookmark, items: [] });
  });

  // Populate tree structure
  bookmarks.forEach((bookmark) => {
    if (bookmark.parentFolder) {
      // Attach bookmark to its parent's items array
      const parent = map.get(bookmark.parentFolder);
      if (parent) {
        parent.items.push(map.get(bookmark.id));
      }
    } else {
      // Root level bookmarks (no parent)
      tree.push(map.get(bookmark.id));
    }
  });

  return tree;
}
