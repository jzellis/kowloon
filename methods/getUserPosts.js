import { Circle, Post, Group, User } from "../schema/index.js";

export default async function (actorId, options) {
  options = {
    page: 1,
    pageSize: 20,
    type: [],
    summary: null,
    userId: null,
    ...options,
  };
  let allAddresses = [`_public@${this.settings.domain}`];
  let actor = await User.findOne({ id: actorId });

  if (options.userId && options.userId != actor.blocked) {
    let circles = await Circle.find({ actorId, members: actorId });
    let groups = await Group.find({
      members: { $all: [actorId, options.userId] },
    });
    allAddresses = [...allAddresses, options.userId, ...circles, ...groups];
  }

  if (options.userId?.split("@")[1] == this.settings.domain)
    allAddresses.push(`_server@${this.settings.domain}`);

  let query = {
    deletedAt: { $eq: null },
    actorId,
    $or: [
      { to: { $in: allAddresses } },
      { bto: { $in: allAddresses } },
      { cc: { $in: allAddresses } },
      { bcc: { $in: allAddresses } },
    ],
  };
  if (options.type.length > 0) query["object.type"] = { $in: options.type };

  let items = await Post.find(query)
    .limit(options.pageSize ? options.pageSize : 0)
    .select("-bto -bcc -flagged -deletedAt -deletedBy -_id -__v")
    .skip(options.pageSize ? options.pageSize * (options.page - 1) : 0)
    .sort({ createdAt: -1 })
    .populate(populate);
}
