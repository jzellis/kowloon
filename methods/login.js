import { Circle, User } from "../schema/index.js";

export default async function (username, password = "") {
  console.log(arguments);
  let user = await User.findOne({ username }).select("-keys.private");

  if (!user) return false;
  if (!(await user.verifyPassword(password))) return false;
  // user.keys.private = undefined;
  user.lastLogin = new Date();
  await user.save();
  // return user.accessToken;

  return {
    user: {
      ...user._doc,
      password: undefined,
      _id: undefined,
      flagged: undefined,
      circles: await Circle.find({ actorId: user.id, deletedAt: null })
        .lean()
        .sort({ createdAt: -1 })
        .select("-_id -__v -deletedAt"),
    },
  };
}
