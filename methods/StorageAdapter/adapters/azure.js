import StorageAdapter from "../StorageAdapter.js";
import { BlobServiceClient } from "@azure/storage-blob";
import mime from "mime-types";
import File from "../schema/File.js";

const azureClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_CONNECTION_STRING
);
const containerClient = azureClient.getContainerClient(
  process.env.AZURE_CONTAINER
);

export default class AzureStorageAdapter extends StorageAdapter {
  async upload(buffer, { originalFileName, actorId, title, summary }) {
    const extension = originalFileName.split(".").pop();
    const mimeType = mime.lookup(extension) || "application/octet-stream";
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });

    const file = new File({
      originalFileName,
      title,
      summary,
      mimeType,
      extension,
      size: buffer.length,
      actorId,
      url: `${process.env.AZURE_PUBLIC_URL}/${fileName}`,
    });

    await file.save();
    return file.toObject();
  }
}
