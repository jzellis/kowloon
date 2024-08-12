import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let response = await Kowloon.getGroup(req.params.id);
  response.posts = await Kowloon.getPosts(
    { groups: req.params.id },
    { page: req.query.page ? parseInt(req.query.page) : 1 }
  );

  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
