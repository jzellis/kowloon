import Kowloon from "../../Kowloon.js";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import getSettings from "../../methods/getSettings.js";
import { File } from "../../schema/index.js";
import util from "util";

const __dirname = dirname(fileURLToPath(import.meta.url));
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();

  let response = {};
  if (Kowloon.settings.registrationIsOpen === true) {
    let activity = JSON.parse(req.body.activity);
    activity.actorId = `@${activity.object.username}@${Kowloon.settings.domain}`;
    console.log(
      util.inspect(activity, { showHidden: false, depth: null, colors: true })
    );
    let user = await Kowloon.createActivity(activity);
    if (user) {
      let file = await File.create({
        originalFileName: req.files.icon.name,
        mimeType: req.files.icon.mimetype,
        size: req.files.icon.size,
        title: activity.username || "",
        extension: path.extname(req.files.icon.name).substring(1),
        actorId: activity.actorId,
      });
      let uploadDir = `${path.resolve(__dirname, "../../")}/images/users`;
      let uploadPath = `${uploadDir}/${activity.object.username}.${file.extension}`;
      console.log(uploadPath);
      try {
        await fs.access(uploadDir);
      } catch (e) {
        await fs.mkdir(uploadDir, { recursive: true });
      }

      req.files.icon.mv(uploadPath, (err) => {
        console.error(err);
      });

      file.location = uploadPath;
      await file.save();
      response = { file };
    }
    response.user = user;
  } else {
    response.error = "Registration is not open for this server at this time!";
  }
  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
