import Kowloon from "../Kowloon.js";
import buildPageTree from "../methods/buildPageTree.js";
import Page from "../schema/Page.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();

  let query = await Kowloon.generateQuery(req.user?.id);
  let pages = await Page.find(query).lean();

  pages = buildPageTree(pages);
  let response = {
    status,
    ok: "ok",
    server: {
      id: Kowloon.settings.actorId,
      profile: {
        name: Kowloon.settings.profile.name,
        description: Kowloon.settings.profile.description,
        icon: Kowloon.settings.profile.icon,
        location: Kowloon.settings.profile.location || undefined,
      },
      url: `https://${Kowloon.settings.domain}`,
      inbox: `https://${Kowloon.settings.domain}/inbox`,
      outbox: `https://${Kowloon.settings.domain}/outbox`,
      publicKey: Kowloon.settings.publicKey,
    },
    pages,
    queryTime: Date.now() - qStart,
  };

  res.status(status).json(response);
}
