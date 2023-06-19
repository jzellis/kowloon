import Kowloon from "../../../kowloon/index.js";
import { getLinkPreview, getPreviewFromContent } from "link-preview-js";

export default async function handler(req, res, next) {
  let response = {};
  try {
    response = await getLinkPreview(req.query.url, { followRedirects: true });
  } catch (e) {}
  let status = 200;

  res.status(status).json(response);
}
