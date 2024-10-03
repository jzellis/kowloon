import Kowloon from "../Kowloon.js";
import util from "util";

console.log(
  util.inspect(
    await Kowloon.getFeed("@admin@kowloon.social"),
    false,
    null,
    true
  )
);

process.exit(0);
