import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let response = {};
  let page = req.query.page;
  if (!req.user) {
    status = 401;
    response.error = "Must be logged in";
  } else {
    let items = await Kowloon.getInbox(req.user.id);
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      id: "//" + Kowloon.settings.domain,
      summary: `${Kowloon.settings.title} | Inbox`,
      totalItems: items.length,
      page,
      items,
      queryTime: 0,
    };
  }

  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
