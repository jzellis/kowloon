import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let query = req.user
    ? {
        id: req.params.id,
        $or: [
          { actorId: req.user.id },
          { to: { $in: [...req.user.memberships, req.user.id] } },
          { cc: { $in: [...req.user.memberships, req.user.id] } },
          { bcc: { $in: [...req.user.memberships, req.user.id] } },

          { to: "@public" },
        ],
      }
    : { id: req.params.id, to: "@public" };
  let group = await Kowloon.getGroup(query);
  let response = {
    queryTime: Date.now() - qStart,
  };

  if (group) {
    response.group = group;
  } else {
    response.error = "Group not found";
  }

  res.status(status).json(response);
}
