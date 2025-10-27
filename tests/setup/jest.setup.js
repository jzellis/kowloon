import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "node:http";
import { buildApp } from "../helpers/app.js";

let mongod, server;

beforeAll(async () => {
  // Only setup once globally
  if (global.__TEST_SETUP_COMPLETE__) {
    return;
  }

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Only connect if not already connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { dbName: "kowloon_test" });
  }

  // Minimal Settings for pre-save hooks
  const { Settings, User } = await import("#schema");
  await Settings.create([
    { name: "domain", value: "kwln.org" },
    { name: "actorId", value: "https://kwln.org/server" },
    { name: "defaultPronouns", value: "they/them" },
  ]);

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
  global.__TEST_MONGOD__ = mongod;
  global.__TEST_SERVER__ = server;
}, 60000);

afterAll(async () => {
  // Cleanup is handled once by the last test file
  if (global.__TEST_MONGOD__) {
    await mongoose.disconnect();
    if (global.__TEST_SERVER__) {
      await new Promise((resolve) => global.__TEST_SERVER__.close(resolve));
    }
    await global.__TEST_MONGOD__.stop();
    global.__TEST_SETUP_COMPLETE__ = false;
  }
});
