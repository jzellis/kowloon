import StorageAdapter from "../StorageAdapter.js";
import fs from "fs/promises";
import path from "path";
import mime from "mime-types";
import File from "../../../schema/File.js";

export default class LocalStorageAdapter extends StorageAdapter {
  async upload(buffer, { originalFileName, actorId, title, summary }) {
    const extension = path.extname(originalFileName).slice(1) || "bin";
    const mimeType = mime.lookup(extension) || "application/octet-stream";
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;
    const destPath = path.join("public", "files", fileName);

    await fs.writeFile(destPath, buffer);

    const file = new File({
      originalFileName,
      title,
      summary,
      mimeType,
      extension,
      size: buffer.length,
      actorId,
    });

    await file.save();
    return file.toObject();
  }

  async delete(fileUrl) {
    // Optional implementation
  }
}
