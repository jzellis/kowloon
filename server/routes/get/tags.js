import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let response = {};
  let status = 200;

  Kowloon.setUser(req.user || null);
  let page = req.query.page || 1;
  let items = await Kowloon.getActivities({ "object.tags": req.params.tag });

  response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${Kowloon.settings.domain}/tags/${req.params.tag}`,
    name: `${Kowloon.settings.title} posts tagged #${req.params.tag}`,
    type: "OrderedCollection",
    current: page,
    totalItems: items.length,

    items,
  };
  res.status(status).json(response);
}
