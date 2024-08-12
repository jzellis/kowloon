import { Circle, Group } from "../schema/index.js";

export default async function (userId, item) {
  let userCircles = await Circle.find({ members: userId });
  let userGroups = await Group.find({ members: userId });
  let addressees = Array.from(
    new Set(Array.from(...item.to, item.bto, item.cc, item.bcc))
  ); // Creates a unique array of all item addressees

  let canView = false;
  return (
    item.public == true || // Is this item public?
    item.actorId == userId || // Is this item owned by the user?
    addressees.includes(userId) || // Is this item addressed to the user?
    item.circles.some((c) => userCircles.includes(c)) || // Is this item to a circle the user belongs to?
    item.groups.some((g) => userGroups.includes(g)) // Is this item to a group the user belongs to?
  );
}
