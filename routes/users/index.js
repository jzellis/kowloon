import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  try {
    let query = req.user
      ? {
          $or: [
            { to: { $in: [...req.user.memberships, req.user.id] } },
            { cc: { $in: [...req.user.memberships, req.user.id] } },
            { bcc: { $in: [...req.user.memberships, req.user.id] } },

            { to: "@public" },
          ],
        }
      : { to: "@public" };
    let users = await Kowloon.getUsers(query, {
      page: req.query.page || 1,
    });
    let response = {
      users,
      queryTime: Date.now() - qStart,
    };

    res.status(status).json(response);
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: e });
  }
}
