// /routes/files/upload.js
// Handle file uploads via multipart/form-data
import route from "../utils/route.js";
import { getStorageAdapter } from "#methods/files/StorageAdapter/StorageManager.js";

export default route(async ({ req, body, setStatus, set }) => {
  if (!req.file) {
    setStatus(400);
    set("error", "No file uploaded");
    return;
  }

  const { originalname: originalFileName, buffer } = req.file;
  const { actorId, title, summary } = body;

  // If no actorId provided, use the authenticated user's ID
  const uploadActorId = actorId || req.user?.id;

  if (!uploadActorId) {
    setStatus(400);
    set("error", "actorId is required");
    return;
  }

  try {
    const storage = getStorageAdapter();
    const file = await storage.upload(buffer, {
      originalFileName,
      actorId: uploadActorId,
      title,
      summary,
    });

    setStatus(200);
    set("file", file);
  } catch (error) {
    console.error("File upload error:", error);
    setStatus(500);
    set("error", error.message || "Failed to upload file");
  }
}, { allowUnauth: true });
