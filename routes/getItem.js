import Kowloon from "../Kowloon.js";
import {
  Activity,
  Bookmark,
  Circle,
  Group,
  Event,
  Page,
  Post,
  React,
  Reply,
  User,
} from "../schema/index.js";

const endpoints = {
  activities: {
    type: "Activity",
    collection: Activity,
    select:
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source",
  },
  bookmarks: {
    type: "Bookmark",
    collection: Bookmark,
    select:
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source",
  },
  circles: {
    type: "Circle",
    collection: Circle,
    select: "-deletedAt -deletedBy -_id -__v -source -members",
  },
  groups: {
    type: "Group",
    collection: Group,
    select:
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source",
  },
  events: {
    type: "Event",
    collection: Event,
    select:
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source",
  },
  pages: {
    type: "Page",
    collection: Page,
    select:
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source",
  },
  posts: {
    type: "Post",
    collection: Post,
    select:
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source -signature",
  },
  replies: {
    type: "Reply",
    collection: Reply,
    select:
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source",
  },
  reacts: {
    type: "React",
    collection: React,
    select:
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source",
  },
  users: {
    type: "User",
    collection: User,
    select: "-_id username id profile publicKey",
  },
};

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = { server: req.server };
  let select = endpoints[req.collection].select;
  let query = await Kowloon.generateQuery(req.user || null);
  let summary = `${Kowloon.settings.profile.name} | ${
    String(req.collection).charAt(0).toUpperCase() +
    String(req.collection).slice(1)
  } | ${req.params.id}`;
  if (req.collection != "pages") query.id = req.params.id;
  if (req.collection == "pages") query.slug = req.params.id;
  if (req.collection == "users" && req.user && req.user.id == req.params.id)
    select += " following muted blocked prefs";

  let item = await endpoints[req.collection].collection
    .findOne(query)
    .select(select)
    .lean();
  if (item) {
    response = {
      server: req.server,
      type: req.type,
      status,
      "@context": "https://www.w3.org/ns/activitystreams",
      url: `${req.protocol}://${req.hostname}${req.originalUrl}`,
      timestamp: new Date().toISOString(),
    };
    response.data = item;
  } else {
    response.error = `${endpoints[req.collection].type} not found`;
  }
  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
