import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res) {
  let page = req.query.page || 1;
  let items = await Kowloon.getPublicOutbox(page);
  let response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${Kowloon.settings.domain}/outbox`,
    name: `${Kowloon.settings.title} public posts`,
    type: "OrderedCollection",
    current: page,
    totalItems: items.length,
    items,
  };
  let status = 200;

  res.status(status).json(response);
}
