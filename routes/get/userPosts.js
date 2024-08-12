import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let query = req.user
    ? {
        actorId: req.params.id,
        $or: [
          { public: true },
          { actorId: req.user.id },
          { to: req.user.id },
          { bto: req.user.id },
          { cc: req.user.id },
          { bcc: req.user.id },
        ],
      }
    : { actorId: req.params.id, public: true };
  let response = await Kowloon.getPosts(query, {
    page: req.query.page ? parseInt(req.query.page) : 1,
  });
  res.status(status).json(response);
}
