import { User, Circle, Group } from "../schema/index.js";
import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;
import sanitize from "./sanitize.js";

export default async function (id = "", options) {
  options = {
    sanitized: true,
    deleted: false,
    ...options,
  };
  if (id) {
    let _id =
      id.charAt(0) == "@" ? id.split("@")[1].split("@")[0] : id.split("@")[0];
    let result = {
      user: await User.findOne(
        (options.deleted = false
          ? { $or: [{ username: _id }, { id: _id }], deletedAt: null }
          : { $or: [{ username: _id }, { id: _id }] })
      ).select("id username profile keys.public"),
    };

    // if (Array.isArray(result) && result.length === 1) result = result[0];
    return options.sanitized === true ? sanitize(result) : result;
  } else {
    return false;
  }
}
