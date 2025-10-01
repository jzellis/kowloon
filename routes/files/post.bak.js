import Kowloon from "../../Kowloon.js";
import fs from "fs";
import { File } from "../../schema/index.js";
import { IncomingForm } from "formidable";

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  const form = new IncomingForm({
    uploadDir: Kowloon.settings.uploadDir, // Directory to store uploaded files
    keepExtensions: true, // Preserve file extensions
    multiples: true, // Allow multiple file uploads
  });

  let parsed = await form.parse(req);
  let files = parsed[1].files;
  console.log(files[0]);
  let metadata = JSON.parse(parsed[0].attachments);

  let attachments = metadata.map((a, i) => {
    return {
      actorId: req.user?.id,
      title: a.title,
      summary: a.summary,
      mimeType: files[i].mimetype,
      url: `https://${Kowloon.settings.domain}/uploads/${files[i].newFilename}`,
      size: files[i].size,
    };
  });
  attachments = await File.create(attachments);
  attachments = await File.find({
    id: { $in: attachments.map((a) => a.id) },
  })
    .lean()
    .select("-_id -__v -deletedAt");
  response = { attachments };

  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}

// app.listen(3000, () => console.log("Server running on port 3000"));
