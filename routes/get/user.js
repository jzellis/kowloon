import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;

  let response = await Kowloon.getUser(req.params.id);
  response.circles = await Kowloon.getCircles(
    req.user && req.user.id === req.params.id
      ? { actorId: req.params.id }
      : { actorId: req.params.id, public: true },
    {
      fields: "id name icon",
    }
  );

  response.groups = await Kowloon.getGroups(
    req.user && req.user.id === req.params.id
      ? { members: req.params.id }
      : { members: req.params.id, public: true },
    {
      fields: "id name icon",
    }
  );

  response.posts = await Kowloon.getPosts(
    req.user && req.user.id === req.params.id
      ? { actorId: req.params.id }
      : { actorId: req.params.id, public: true }
  );

  response.bookmarks = await Kowloon.getBookmarks(
    req.user && req.user.id === req.params.id
      ? { actorId: req.params.id }
      : { actorId: req.params.id, public: true }
  );

  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
