import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let query = req.user
    ? {
        $or: [{ public: true }, { actorId: req.user.id }],
      }
    : { public: true };
  let response = await Kowloon.getCircles(query);
  res.status(status).json(response);
}
