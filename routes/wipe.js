import Kowloon from "../Kowloon.js";
import {
  Activity,
  Circle,
  Bookmark,
  Event,
  Group,
  Page,
  Post,
  React,
  Reply,
  User,
} from "../schema/index.js";

export default async function (req, res, next) {
  const modelMap = {
    users: User,
    activities: Activity,
    bookmarks: Bookmark,
    circles: Circle,
    groups: Group,
    events: Event,
    pages: Page,
    posts: Post,
    reacts: React,
    replies: Reply,
  };
  try {
    const { type } = req.body || {};
    const key = String(type || "").toLowerCase();
    const Model = modelMap[key];
    if (!Model)
      return res
        .status(400)
        .json({ status: "error", error: `Unknown collection "${type}"` });

    let result;
    if (key === "users") {
      result = await Model.deleteMany({ username: { $ne: "admin" } });
    } else {
      result = await Model.deleteMany({});
    }

    res.json({
      status: "success",
      type: key,
      deletedCount: result?.deletedCount ?? 0,
    });
  } catch (err) {
    console.error("Wipe error:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
}
