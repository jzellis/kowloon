import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let response = await Kowloon.getActivity(req.params.id);
  if (
    (!req.user && response.activity.public === false) ||
    (req.user && !(await Kowloon.canView(req.user.id, response.activity)))
  ) {
    status = 400;
    response = {
      error: "You do not have permission to view this activity.",
    };
  }

  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
