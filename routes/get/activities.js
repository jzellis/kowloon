import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();
  let status = 200;
  let query = req.user
    ? {
        $or: [
          { public: true },
          { actorId: req.user.id },
          { to: req.user.id },
          { bto: req.user.id },
          { cc: req.user.id },
          { bcc: req.user.id },
        ],
      }
    : { public: true };
  let options = {
    page: req.params.page || 1,
    pageLength: 20,
  };
  // let response = {
  //   ...Kowloon.defaultResponse,
  //   id: req.protocol + "://" + req.get("host") + req.originalUrl,
  //   summary: `${Kowloon.settings.title} Activities`,
  //   page: parseInt(req.query.page) || 1,
  // };
  let response = await Kowloon.getActivities(query, {
    page: options.page,
    pageLength: options.pageLength,
    id: req.protocol + "://" + req.get("host") + req.originalUrl,
    summary: "Activities",
  });
  // let totalItems = items.length || 1;
  // let response = Kowloon.response({
  //   page: parseInt(req.query.page) || 1,
  //   id: req.protocol + "://" + req.get("host") + req.originalUrl,
  //   items,
  //   totalItems,
  //   summary: "Activities",
  //   ordered: true,
  // });

  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
