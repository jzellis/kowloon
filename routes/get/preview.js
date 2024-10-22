import { getLinkPreview } from "link-preview-js";

export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  if (req.user) {
    try {
      let preview = await getLinkPreview(req.query.url, {
        headers: {
          "user-agent": "googlebot",
          "Accept-Language": "en-US",
        },
        followRedirects: true,
        timeout: 5000,
      });
      response = preview;
    } catch (e) {
      console.log(e);
      response.error = e;
    }
  } else {
    status = 401;
    response.error = "Must be logged in";
  }
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
