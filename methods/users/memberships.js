// This returns all circles and groups the user is in

import { Activity, Circle, Group } from "#schema";

export default async function (id) {
  let circles = (
    await Circle.find({ $or: [{ "members.id": id }, { actorId: id }] }).lean()
  ).map((c) => c.id);
  let groups = (
    await Group.find({
      $or: [{ "members.id": id }, { actorId: id }, { admins: id }],
    }).lean()
  ).map((g) => g.id);
  let memberships = [...circles, ...groups];
  return memberships;
}
