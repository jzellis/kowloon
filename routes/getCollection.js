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
} from "#schema";

const endpoints = {
  activities: {
    type: "Activity",
    collection: Activity,
    select: " -deletedAt -deletedBy -_id -__v -source",
  },
  bookmarks: {
    type: "Bookmark",
    collection: Bookmark,
    select: " -deletedAt -deletedBy -_id -__v -source",
  },
  circles: {
    type: "Circle",
    collection: Circle,
    select: "-deletedAt -deletedBy -_id -__v -source -members",
  },
  groups: {
    type: "Group",
    collection: Group,
    select: " -deletedAt -deletedBy -_id -__v -source",
  },
  events: {
    type: "Event",
    collection: Event,
    select: " -deletedAt -deletedBy -_id -__v -source",
  },
  pages: {
    type: "Page",
    collection: Page,
    select: " -deletedAt -deletedBy -_id -__v -source",
  },
  posts: {
    type: "Post",
    collection: Post,
    select: " -deletedAt -deletedBy -_id -__v -source -signature",
  },
  replies: {
    type: "Reply",
    collection: Reply,
    select: " -deletedAt -deletedBy -_id -__v -source",
  },
  reacts: {
    type: "Reacts",
    collection: React,
    select: " -deletedAt -deletedBy -_id -__v -source",
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
  let response = {
    server: req.server,
    type: req.type,
  };
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = {};
  let select = endpoints[req.collection].select;

  if (req.query.sort) {
    sort = `-${req.query.sort}`;
  } else {
    sort = `-updatedAt`;
  }
  let query = await Kowloon.query(req.user || null);
  if (req.query.since)
    query.updatedAt = { $gte: new Date(req.query.since).toISOString() };

  let summary = `${Kowloon.settings.profile.name} | ${
    String(req.collection).charAt(0).toUpperCase() +
    String(req.collection).slice(1)
  } | page ${page}`;

  let parent;
  if (req.parent) {
    switch (true) {
      case req.parent == "groups":
        query.to = req.parentId;
        parent = await Group.findOne({ id: req.parentId })
          .select("name")
          .lean();
        break;
      case req.parent == "events":
        query.to = req.parentId;
        parent = await Event.findOne({ id: req.parentId })
          .select("name")
          .lean();
        break;
      case req.parent == "users":
        query.actorId = req.parentId;
        parent = await User.findOne({ id: req.parentId }).select("name").lean();

        break;
      case req.parent == "posts" &&
        (req.collection == "replies" || req.collection == "reacts"):
        query.target = req.parentId;
        parent = await Post.findOne({ id: req.parentId }).select("name").lean();

        break;
    }
  }

  if (req.query.type) query.type = { $in: req.query.type };

  let items = await endpoints[req.collection].collection
    .find(query)
    .select(select)
    .limit(pageSize ? pageSize : 0)
    .skip(pageSize ? pageSize * (page - 1) : 0)
    .sort(sort)
    .lean();
  let totalItems = await endpoints[req.collection].collection.countDocuments(
    query
  );

  // This transforms each item to include the "canReply", "canReact" and "canShare" flags
  let memberships = [];

  if (req.user) {
    memberships = await Kowloon.getUserMemberships(req.user.id); // e.g. ['circle:abc', 'group:def']

    const membershipSet = new Set(memberships);

    if (req.user && req.server && req.user.id.endsWith(req.server.id)) {
      membershipSet.add(req.server.id);
    }
    membershipSet.add("@public");
    items.forEach((item) => {
      item.canReply = membershipSet.has(item.replyTo);
      item.canReact = membershipSet.has(item.reactTo);
      item.canShare = item.to === "@public";
      delete item.replyTo;
      delete item.reactTo;
      delete item.to;
    });
  } else {
    items.forEach((item) => {
      item.canReply = item.replyTo === "@public";
      item.canReact = item.reactTo === "@public";
      item.canShare = item.to === "@public";
      delete item.replyTo;
      delete item.reactTo;
      delete item.to;
    });
  }
  response = {
    server: req.server,
    type: req.type,
    status,
    "@context": "https://www.w3.org/ns/activitystreams",
    data: {
      summary,
      totalItems,
      totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
      currentPage: page,
      firstItem: (page - 1) * pageSize + 1,
      lastItem: Math.min(page * pageSize, totalItems),
      count: items.length,
      nextPage: page + 1,
      prevPage: page - 1,
      hasMore: totalItems > page * pageSize,
      items,
    },
    url: `${req.protocol}://${req.hostname}${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  };
  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
