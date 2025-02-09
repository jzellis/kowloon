import { query } from "express";
import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let bookmark = await Kowloon.getBookmark({ id: req.params.id });
  let response = {
    queryTime: Date.now() - qStart,
  };

  if (bookmark) {
    response.bookmark = bookmark;
  } else {
    response.error = "Bookmark not found";
  }

  res.status(status).json(response);
}
