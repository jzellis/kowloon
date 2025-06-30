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
    type: "Reacts",
    collection: React,
    select:
      "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source",
  },
  users: {
    type: "Person",
    collection: User,
    select: "-_id username id profile publicKey",
  },
};

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = { server: req.server };
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = {};

  let query = await Kowloon.generateQuery(req.user || null);
  query.id = req.params.id;

  let item = await endpoints[req.collection].collection
    .findOne(query)
    .select("id name members")
    .lean();

  let totalItems = item.members.length;

  response = {
    server: req.server,
    "@context": "https://www.w3.org/ns/activitystreams",
    type: "OrderedCollection",
    summary: `${Kowloon.settings.profile.name} | ${
      item?.name || ""
    } Members | page ${page}`,
    totalItems,
    totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
    items: item.members || [],
    url: `${req.protocol}://${req.hostname}${req.originalUrl}`,
    timestamp: Date.now(),
  };
  response[endpoints[req.collection].type.toLowerCase()] = item;
  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
