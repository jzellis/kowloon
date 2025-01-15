// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Activity, Invite } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let emails = req.query.emails?.split(",") || [];
  let numInvites =
    req.query.emails?.length > 0 ? req.query.emails.length : req.query.num || 1;
  response.invites = [];

  for (let i = 0; i < numInvites; i++) {
    // let details = req.query.emails[i] ? { email: req.query.emails[i] } : {};
    let invite = await Invite.create({ actorId: "test" });
    response.invites.push(invite);
  }

  res.status(status).json(response);
}
