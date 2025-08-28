// server.js
import express from "express";
import cookieParser from "cookie-parser";
import nocache from "nocache";
import cors from "cors";
import http from "http";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import routes from "./routes/routes.js";
import fs from "fs";
import schedule from "node-schedule";

const __dirname = `${dirname(fileURLToPath(import.meta.url))}`;
const app = express();

app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);
app.use(cookieParser());
app.use(nocache());
app.use(routes);

const port = normalizePort(process.env.PORT || "3000");
app.set("port", port);

const server = http.createServer(
  // {
  //   key: fs.readFileSync("./ssl/server.key"),
  //   cert: fs.readFileSync("./ssl/server.crt"),
  // },
  app
);

server.listen(port || 3001, "0.0.0.0");
server.on("error", onError);
server.on("listening", onListening);

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }
  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  console.log("Listening on " + bind);
  console.log("Server is running....");
}

function normalizePort(val) {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}
