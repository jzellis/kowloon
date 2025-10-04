import StorageAdapter from "../StorageAdapter.js";
import { Storage } from "@google-cloud/storage";
import mime from "mime-types";
import File from "../schema/File.js";

const gcs = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  keyFilename: process.env.GCS_KEY_FILE,
});
const bucket = gcs.bucket(process.env.GCS_BUCKET);

export default class GCSStorageAdapter extends StorageAdapter {
  async upload(buffer, { originalFileName, actorId, title, summary }) {
    const extension = originalFileName.split(".").pop();
    const mimeType = mime.lookup(extension) || "application/octet-stream";
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;
    const fileObj = bucket.file(fileName);

    await fileObj.save(buffer, {
      contentType: mimeType,
      public: true,
    });

    const file = new File({
      originalFileName,
      title,
      summary,
      mimeType,
      extension,
      size: buffer.length,
      actorId,
      url: `${process.env.GCS_PUBLIC_URL}/${fileName}`,
    });

    await file.save();
    return file.toObject();
  }
}
