// routes/pages/path.js
import route from "../utils/route.js";
import getPageByPath from "#methods/pages/getByPath.js";

export default route(async ({ req, params, set, setStatus }) => {
  // req.params[0] contains everything after /pages/
  const raw = params[0] || "";
  const path = decodeURIComponent(raw);

  const reso = await getPageByPath(path, {
    viewerId: req.user?.id || null,
  });

  if (!reso?.item) {
    setStatus(404);
    set("error", "Page not found or not visible");
    return;
  }

  set("item", reso.item);
});
