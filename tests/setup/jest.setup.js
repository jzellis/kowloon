import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "node:http";
import { buildApp } from "../helpers/app.mjs";

let mongod, server;

beforeAll(async () => {
  jest.setTimeout(60000);

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: "kowloon_test" });

  // Minimal Settings for pre-save hooks
  const { Settings } = await import("#schema");
  await Settings.create([
    { name: "domain", value: "kwln.org" },
    { name: "actorId", value: "https://kwln.org/server" },
    { name: "defaultPronouns", value: "they/them" },
  ]);

  const app = await buildApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  global.__TEST_BASE_URL__ = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongod) await mongod.stop();
});
