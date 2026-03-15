import "dotenv/config";
import mongoose from "mongoose";
import http from "node:http";
import { buildApp } from "../helpers/app.js";

let server;

beforeAll(async () => {
  // Only setup once globally
  if (global.__TEST_SETUP_COMPLETE__) {
    return;
  }

  const baseUri = process.env.MONGO_URI || "mongodb://localhost:27017/kowloon";
  const uri = baseUri.replace(/\/(\w+)(\?|$)/, "/kowloon_test$2");

  // Only connect if not already connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  // Wipe the test DB before seeding
  await mongoose.connection.dropDatabase();

  // Minimal Settings for pre-save hooks
  const { User } = await import("#schema");

  // Create admin user for tests
  const bcryptModule = await import("bcryptjs");
  const bcrypt = bcryptModule.default || bcryptModule;
  const hashedPassword = await bcrypt.hash("adminpass", 10);
  await User.create({
    id: "@admin@kwln.org",
    username: "admin",
    email: "admin@kwln.org",
    password: hashedPassword,
    profile: { name: "Admin" },
  });

  const app = await buildApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  global.__TEST_BASE_URL__ = `http://127.0.0.1:${server.address().port}`;
  global.__TEST_SETUP_COMPLETE__ = true;
  global.__TEST_SERVER__ = server;
}, 60000);

afterAll(async () => {
  if (global.__TEST_SETUP_COMPLETE__) {
    await mongoose.disconnect();
    if (global.__TEST_SERVER__) {
      await new Promise((resolve) => global.__TEST_SERVER__.close(resolve));
    }
    global.__TEST_SETUP_COMPLETE__ = false;
  }
});
