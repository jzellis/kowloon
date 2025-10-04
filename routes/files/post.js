import { IncomingForm } from "formidable";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { File } from "#schema";
import { v4 as uuidv4 } from "uuid";

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_ACCESS_SECRET_KEY,
    },
    forcePathStyle: true, // S3 compatibility
  });

  let uploadedFiles = [];

  const upload = multer({
    limits: { fileSize: 50 * 1024 * 1024 },
    storage: multerS3({
      s3: s3,
      bucket: process.env.S3_BUCKET,
      acl: "public-read",
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        let newName =
          Date.now().toString() +
          "-" +
          uuidv4() +
          "." +
          file.originalname.split(".").pop();
        console.log(file);
        cb(null, newName);

        uploadedFiles.push(newName);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
  });

  const uploadMultiple = upload.array("files"); // Accepts up to 10 files
  uploadMultiple(req, res, (err) => {
    if (err) {
      response.error = err;
      console.log(err);
    }
  });

  const form = new IncomingForm();
  let parsed = await form.parse(req);
  let metadata = JSON.parse(parsed[0].attachments);
  let files = parsed[1].files;

  let attachments = metadata.map((a, i) => {
    return {
      actorId: req.user?.id,
      title: a.title,
      summary: a.summary,
      mimeType: files[i].mimetype,
      url: `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${uploadedFiles[i]}`,
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
  res.status(status).json(response);
  // next();
}
