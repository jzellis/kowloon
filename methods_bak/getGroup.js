import { Group } from "../schema/index.js";
import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;
import sanitize from "./sanitize.js";

export default async function (id = new ObjectId(""), options) {
  options = { sanitized: true, deleted: false, ...options };
  let _id = id.split(":")[1].split("@")[0];
  let result = {
    group: await Group.findOne(
      (options.deleted = false
        ? { $or: [{ _id: _id }, { id: _id }], deletedAt: null }
        : { $or: [{ _id: _id }, { id: _id }] })
    ).populate({
      path: "actor",
      select: "username email profile keys.public",
    }),
  };
  // if (Array.isArray(result) && result.length === 1) result = result[0];
  return options.sanitized === true ? sanitize(result) : result;
}
