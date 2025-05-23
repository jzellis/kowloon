import Kowloon from "../../Kowloon.js";
import { Bookmark } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    ...(await Kowloon.generateQuery(req.user?.id)),
    id: req.params.id,
  };

  let bookmark = await Bookmark.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
  );
  if (bookmark) {
    response = {
      "@context": "https://www.w3.org/ns/bookmarkstreams",
      type: "Bookmark",
      bookmark,
    };
    // response.bookmarks = await Bookmark.find(query);
  } else {
    response.error = "Bookmark not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
