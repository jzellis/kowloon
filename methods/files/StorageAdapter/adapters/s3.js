import StorageAdapter from "../StorageAdapter.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import File from "#schema/File.js";
import mime from "mime-types";

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

export default class S3StorageAdapter extends StorageAdapter {
  async upload(buffer, { originalFileName, actorId, title, summary }) {
    const extension = originalFileName.split(".").pop();
    const mimeType = mime.lookup(extension) || "application/octet-stream";
    const key = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const file = new File({
      originalFileName,
      name: title,
      summary,
      mediaType: mimeType,
      extension,
      size: buffer.length,
      actorId,
      url: `${process.env.S3_PUBLIC_URL}/${key}`,
    });

    await file.save();
    return file.toObject();
  }
}
