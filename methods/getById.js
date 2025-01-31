import {
  Activity,
  Bookmark,
  Circle,
  File,
  Group,
  React,
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
  like: React,
  post: Post,
  reply: Reply,
  user: User,
};

export default async function (id) {
  let result;
  if (!id) return new Error("No id provided");
  if (id.startsWith("@")) result = await User.findOne({ id: id });
  else result = await dbs[id.split(":")[0]](findOne({ id: id }));
  if (!result) return new Error("No result found");
  return result;
}
