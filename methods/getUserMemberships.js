import { Activity, Circle, Group } from "../schema/index.js";

export default async function (id) {
  let circles = (
    await Circle.find({ $or: [{ members: id }, { actorId: id }] }).lean()
  ).map((c) => c.id);
  let groups = (
    await Group.find({
      $or: [{ members: id }, { actorId: id }, { admins: id }],
    }).lean()
  ).map((g) => g.id);
  let memberships = [...circles, ...groups];
  return memberships;
}
