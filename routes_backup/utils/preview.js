import Kowloon from "../../Kowloon.js";
import { getLinkPreview } from "link-preview-js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  try {
    let preview = await getLinkPreview(req.query.url, {
      followRedirects: "follow",
    });
    response = {
      url: preview.url,
      title: preview.title,
      summary: preview.description,
      contentType: preview.contentType,
      image: preview.images[0],
    };
  } catch (e) {
    response = { error: "Failed to fetch link preview", details: e.message };
  }

  (response.queryTime = Date.now() - qStart), res.status(status).json(response);
}
