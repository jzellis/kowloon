import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let qStart = Date.now();

  let status = 200;
  if (!req.user) {
    res.status(401).send({ error: "You are not authorized to do that" });
  } else {
    try {
      let activity = { ...req.body.activity, actorId: req.user.id };
      let response = {
        activity: await Kowloon.createActivity(activity),
      };
      let qEnd = Date.now();
      response.queryTime = qEnd - qStart;
      res.status(status).send(response);
    } catch (e) {
      console.log(e);
      res.status(500).send({ error: e });
    }
  }
}
