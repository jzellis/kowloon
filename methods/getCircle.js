import { Circle } from "../schema/index.js";

export default async function (
  query,
  options = {
    actor: true,
    deleted: false,
  }
) {
  let select =
    "-flaggedAt -flaggedBy -flaggedReason -bcc -rbcc -object.bcc -object.rbcc -deletedAt -deletedBy -_id -__v -members.createdAt -members.updatedAt";
  if (typeof query === "string") query = { id: query };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  if (!query) return new Error("No query provided");
  let circle = await Circle.findOne(query)
    .select(select)
    .populate("actor", "-_id username id profile publicKey");
  return circle;
}
