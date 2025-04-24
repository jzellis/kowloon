import Kowloon from "../../Kowloon.js";
import { Inbox } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  if (req.body?.activity)
    await Inbox.create({
      server: `@${Kowloon.parseId(req.body.activity.actorId).server}`,
      ipAddress: req.connection.remoteAddress,
      activity: req.body.activity,
    });
  response = { activity: req.body.activity };
  res.status(status).json(response);
}
