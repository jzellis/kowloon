// /routes/files/get.js
// GET /files/:id - Retrieve file metadata
import route from "../utils/route.js";
import getFile from "#methods/files/get.js";

export default route(async ({ req, setStatus, set }) => {
  const { id } = req.params;

  if (!id) {
    setStatus(400);
    set("error", "File ID is required");
    return;
  }

  try {
    const file = await getFile(id);

    if (!file) {
      setStatus(404);
      set("error", "File not found");
      return;
    }

    setStatus(200);
    set("file", file);
  } catch (error) {
    console.error("File retrieval error:", error);
    setStatus(500);
    set("error", error.message || "Failed to retrieve file");
  }
});
