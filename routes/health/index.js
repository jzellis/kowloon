import express from "express";
import mongoose from "mongoose";

const router = express.Router({ mergeParams: true });

// Health check endpoint — open to any origin so the setup wizard can poll it
// cross-origin from http://server-ip:2999 during installation.
router.get("/", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    // Check MongoDB connection
    const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";

    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
      },
    };

    // If MongoDB is not connected, return 503
    if (mongoStatus !== "connected") {
      return res.status(503).json({
        ...health,
        status: "error",
        message: "Database not connected",
      });
    }

    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: error.message,
    });
  }
});

export default router;
