import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import routes from "./routes/index.js";
import { fileURLToPath } from "url";
import cors from "cors";
import Kowloon from "./kowloon/index.js";
import nocache from "nocache";
const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static("../client/dist/"));
app.use(async (req, res, next) => {
  // res.header("Access-Control-Allow-Credentials", true);
  // res.header("Access-Control-Allow-Origin", "*");
  // res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  // res.header(
  //   "Access-Control-Allow-Headers",
  //   "Authorization, Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers"
  // );
  // res.header("Access-Control-Allow-Credentials", "true");
  // let token = req.headers.authorization
  //   ? req.headers.authorization.split("Bearer ")[1]
  //   : undefined;
  // let user = token ? await Kowloon.auth(token) : undefined;
  // req.user = user || undefined;
  // req.actor = user ? user.actor : undefined;

  next();
});
app.use(logger("dev"));
// app.use(bodyParser({ limit: "100mb" }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(cookieParser());
// app.use(express.static("public"));
app.use(routes);

// app.use(nocache());
app.set("json spaces", 2);

export default app;
