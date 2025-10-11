import route from "./utils/route.js";
import { Page } from "#schema";
import Kowloon from "#kowloon";

export default route(async ({ req, set, setStatus }) => {
  set("server", {
    id: Kowloon.settings.actorId,
    profile: Kowloon.settings.profile,
    pages: Kowloon.pages.buildTree(await Kowloon.pages.list()),
  });
});
