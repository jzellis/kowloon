import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import getSettings from "../../methods/getSettings.js";
import { File } from "../../schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export default async function (req, res) {
  let settings = await getSettings();
  let status = 200;
  let qStart = Date.now();
  let response = {};
  if (req.user) {
    if (!req.user) {
      status = 401;
      response = { error: "Must be logged in" };
    } else {
      console.log(req.body);
      let file = await File.create({
        originalFileName: req.files.image.name,
        mimeType: req.files.image.mimetype,
        size: req.files.image.size,
        title: req.body.title || "",
        description: req.body.description || "",
        extension: path.extname(req.files.image.name).substring(1),
        actorId: req.user.id,
      });
      let uploadDir = `${path.resolve(__dirname, "../../")}/uploads/${new Date()
        .getFullYear()
        .toString()}/${(new Date().getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      let uploadPath = `${uploadDir}/${file._id}.${file.extension}`;
      console.log(uploadPath);
      try {
        await fs.access(uploadDir);
      } catch (e) {
        await fs.mkdir(uploadDir, { recursive: true });
      }

      req.files.image.mv(uploadPath, (err) => {
        console.error(err);
      });

      file.location = uploadPath;
      await file.save();
      response = { file };
    }
  }
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
