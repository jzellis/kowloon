import Kowloon from "../Kowloon.js";
import { Page } from "../schema/index.js";
import buildPageTree from "../methods/buildPageTree.js";

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = { server: req.server };
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = {};
  let select = " -deletedAt -deletedBy -_id -__v -source";

  let summary = `${Kowloon.settings.profile.name} | Pages`;

  let items = await Page.find().select(select).lean();
  items = buildPageTree(items);
  let totalItems = await Page.countDocuments();

  // This transforms each item to include the "canReply", "canReact" and "canShare" flags
  let memberships = [];

  // if (req.user) {
  //   memberships = await Kowloon.getUserMemberships(req.user.id); // e.g. ['circle:abc', 'group:def']

  //   const membershipSet = new Set(memberships);

  //   if (req.user && req.server && req.user.id.endsWith(req.server.id)) {
  //     membershipSet.add(req.server.id);
  //   }
  //   membershipSet.add("@public");
  //   items.forEach((item) => {
  //     item.canReply = membershipSet.has(item.replyTo);
  //     item.canReact = membershipSet.has(item.reactTo);
  //     item.canShare = item.to === "@public";
  //     delete item.replyTo;
  //     delete item.reactTo;
  //     delete item.to;
  //   });
  // } else {
  //   items.forEach((item) => {
  //     item.canReply = item.replyTo === "@public";
  //     item.canReact = item.reactTo === "@public";
  //     item.canShare = item.to === "@public";
  //     delete item.replyTo;
  //     delete item.reactTo;
  //     delete item.to;
  //   });
  // }
  response = {
    server: req.server,
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    summary,
    totalItems,
    items,
    url: `${req.protocol}://${req.hostname}${req.originalUrl}`,
    timestamp: Date.now(),
  };
  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
