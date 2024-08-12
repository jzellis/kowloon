import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let query = req.user?.id
    ? {
        actorId: req.params.id,
        $or: [{ public: true }, { actorId: req.user.id }],
      }
    : { actorId: req.params.id, public: true };
  let response = await Kowloon.getBookmarks(query, {
    page: req.query.page ? parseInt(req.query.page) : 1,
  });
  res.status(status).json(response);
}
