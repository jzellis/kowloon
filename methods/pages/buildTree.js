// #methods/pages/buildTree.js
export default function buildTree(pages) {
  if (!Array.isArray(pages)) return [];
  const map = new Map();
  const roots = [];

  for (const p of pages) map.set(p.id, { ...p, items: [] });

  for (const p of pages) {
    if (p.parentFolder) {
      const parent = map.get(p.parentFolder);
      if (parent) {
        parent.items.push(map.get(p.id));
      } else {
        // orphan: treat as root
        roots.push(map.get(p.id));
      }
    } else {
      roots.push(map.get(p.id));
    }
  }

  // sort children arrays by (order, title) if present
  const sortChildren = (node) => {
    if (Array.isArray(node.items) && node.items.length) {
      node.items.sort((a, b) => {
        if ((a.order ?? 0) !== (b.order ?? 0))
          return (a.order ?? 0) - (b.order ?? 0);
        return (a.title || "").localeCompare(b.title || "");
      });
      node.items.forEach(sortChildren);
    }
  };
  roots.forEach(sortChildren);

  return roots;
}
