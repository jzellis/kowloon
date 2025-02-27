import Kowloon from "../../Kowloon.js";
import { getLinkPreview } from "link-preview-js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  let preview = await getLinkPreview(req.query.url, { followRedirects: true });
  response = {
    url: preview.url,
    title: preview.title,
    summary: preview.description,
    contentType: preview.contentType,
    image: preview.images[0],
  };

  (response.queryTime = Date.now() - qStart), res.status(status).json(response);
}
