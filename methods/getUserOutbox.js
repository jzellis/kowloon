import {
  Activity,
  Bookmark,
  Circle,
  File,
  Group,
  Like,
  Post,
  Reply,
  User,
} from "../schema/index.js";

const dbs = {
  activity: Activity,
  bookmark: Bookmark,
  circle: Circle,
  file: File,
  group: Group,
  like: Like,
  post: Post,
  reply: Reply,
  user: User,
};

export default async function (actorId, query = { to: "@public" }) {
  let result = [];

  if (!actorId) return new Error("No id provided");
  let activities = await dbs.activity
    .find({ actorId: actorId, deletedAt: null, ...query })
    .select("-bcc -_id -__v -deletedAt -deletedBy -flagged")
    .lean();
  let bookmarks = await Bookmark.find({
    actorId: actorId,
    deletedAt: null,
    ...query,
  })
    .select("-bcc -_id -__v -deletedAt -deletedBy -flagged")
    .lean();
  let circles = await Circle.find({
    actorId: actorId,
    deletedAt: null,
    ...query,
  })
    .select("-bcc -_id -__v -deletedAt -deletedBy -flagged")
    .lean();
  let groups = await Group.find({ actorId: actorId, deletedAt: null, ...query })
    .select("-bcc -_id -__v -deletedAt -deletedBy -flagged")
    .lean();
  let likes = await Like.find({ actorId: actorId, deletedAt: null, ...query })
    .select("-bcc -_id -__v -deletedAt -deletedBy -flagged")
    .lean();
  let posts = await Post.find({ actorId: actorId, deletedAt: null, ...query })
    .select("-bcc -_id -__v -deletedAt -deletedBy -flagged")
    .lean();
  let replies = await Reply.find({
    actorId: actorId,
    deletedAt: null,
    ...query,
  })
    .select("-bcc -_id -__v -deletedAt -deletedBy -flagged")
    .lean();
  result = result.concat(
    activities,
    bookmarks,
    circles,
    groups,
    likes,
    posts,
    replies
  );
  result.sort((a, b) => b.createdAt - a.createdAt);
  return result;
}
