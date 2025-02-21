// import Kowloon from "./Kowloon.js";
import express from "express";
import cookieParser from "cookie-parser";
import nocache from "nocache";
import cors from "cors";
import http from "http";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fileUpload from "express-fileupload";
import expressListEndpoints from "express-list-endpoints";

import routes from "./routes/routes.js";
import fs from "fs";

const __dirname = `${dirname(fileURLToPath(import.meta.url))}`;

const app = express();
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(fileUpload());
app.use(
  express.urlencoded({
    extended: true,
    limit: 10000000,
  })
);
app.use(cookieParser());

app.use(nocache());
app.use(routes);

app.use("/", express.static(path.join(__dirname + "/frontend/dist")));
app.use(
  "/static",
  express.static(path.join(__dirname + "/frontend/build/assets"))
);

var port = normalizePort(process.env.PORT || "3000");
app.set("port", port);

var server = http.createServer(
  {
    key: fs.readFileSync("./ssl/kowloon.social.key"),
    cert: fs.readFileSync("./ssl/kowloon.social.crt"),
  },
  app
);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}
function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  console.log("Listening on " + bind);
  console.log("Server is running....");
}

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

// process.exit();
