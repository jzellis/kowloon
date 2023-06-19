import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let response = { error: "You are not allowed to view this" };
  let status = 200;
  let page = req.query.page || 1;
  Kowloon.setUser(req.user || null);
  let theUser = await Kowloon.getUser({ username: req.params.username });

  let domain = Kowloon.settings.apDomain;

  let query =
    Kowloon.user && req.params.username == Kowloon.user.username
      ? {
          actor: Kowloon.user.id,
        }
      : {
          actor: `@${req.params.username}${domain}`,
        };
  if (req.query.replies) query.inReplyTo = { $exists: req.query.replies };
  let items = await Kowloon.getActivities(query, page);

  response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${Kowloon.settings.domain}/${req.params.username}/outbox`,
    name: `${theUser.actor.name}'s posts`,
    type: "OrderedCollection",
    current: page,
    totalItems: items.length,

    items,
  };
  res.status(status).json(response);
}
