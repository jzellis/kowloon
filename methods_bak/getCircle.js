import { Circle } from "../schema/index.js";
import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;
import sanitize from "./sanitize.js";

export default async function (query = { public: true }, options) {
  options = { sanitized: true, deleted: false, ...options };

  // let _id = id.split(":")[1].split("@")[0];
  let result = {
    circle: await Circle.findOne(query).populate({
      path: "actor",
      select: "username email profile keys.public",
    }),
  };
  // if (Array.isArray(result) && result.length === 1) result = result[0];
  return options.sanitized === true ? sanitize(result) : result;
}
