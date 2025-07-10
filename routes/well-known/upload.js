export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = { server: req.server };

  if (req.user) {
    try {
      if (!req.file) {
        throw new Error("No file uploaded");
      }

      const { originalname: originalFileName, buffer } = req.file;
      const { actorId, title, summary } = req.body;

      const storage = getStorageAdapter();
      response.data = await storage.upload(buffer, {
        originalFileName,
        actorId,
        title,
        summary,
      });
    } catch (error) {
      status = 500;
      response.error = error.message;
    }
  } else {
    status = 403;
    response = { error: "You are not authorized to upload files" };
  }

  response.queryTime = Date.now() - qStart;
  res.status(status).json(response);
}
