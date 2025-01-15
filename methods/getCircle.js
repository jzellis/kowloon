import { Circle } from "../schema/index.js";

export default async function (
  query,
  options = {
    actor: false,
    deleted: false,
  }
) {
  if (typeof query === "string") query = { id: query };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  let circle = await Circle.findOne(query).select("-bcc").lean();
  if (circle && options.actor === true)
    await circle.populate("actor", "-_id username id profile keys.public");
  return circle;
}
