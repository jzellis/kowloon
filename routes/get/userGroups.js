import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let query = req.user?.id
    ? {
        $or: [{ members: { $all: [req.user.id, req.params.id] } }],
      }
    : { members: req.params.id, public: true };
  let response = await Kowloon.getGroups(query, {
    page: req.query.page ? parseInt(req.query.page) : 1,
  });
  res.status(status).json(response);
}
