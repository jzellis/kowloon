import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  Kowloon.setUser(req.user || null);
  let user = await Kowloon.getUser({ username: req.params.username });
  console.log("Actors:", req.query.actors);
  let items = await Kowloon.getActors(req.query.actors);
  let response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${Kowloon.settings.domain}/actors`,
    name: `${Kowloon.settings.title} actors`,
    type: "Collection",
    totalItems: items.length,
    items,
  };
  let status = 200;

  res.status(status).json(response);
}
