// routes/pages/collection.js
import route from "../utils/route.js";
import getPagesTree from "#methods/pages/getTree.js";

export default route(async ({ req, set }) => {
  const { tree, count } = await getPagesTree({
    viewerId: req.user?.id || null,
  });

  set("items", tree);
  set("count", count);
});
