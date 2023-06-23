import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let response = { error: "You are not allowed to view this" };
  let status = 200;

  Kowloon.setUser(req.user || null);
  let page = req.query.page || 1;
  if (
    Kowloon.user &&
    Kowloon.user.actor &&
    Kowloon.user.username == req.params.username
  ) {
    let actor = `@${req.params.username}${Kowloon.settings.apDomain}`;
    let query = { to: actor, page };
    if (req.query.type) query.types = req.query.type;

    if (req.query.mine) query.showMine = true;
    if (req.query.actors) query["activity.actor"] = { $in: actors };
    if (req.query.read) query.read = req.query.read;
    let items = await Kowloon.getInboxItems(query, page);
    // items = items.map((i) => i.id);
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${Kowloon.settings.domain}/${req.params.username}/inbox`,
      // name: `${Kowloon.user.actor.name}'s inbox`,
      type: "OrderedCollection",
      current: page,
      totalItems: items.length,

      items,
    };
  }
  res.status(status).json(response);
}
