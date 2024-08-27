import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// console.log(__dirname);

let mainMod = {};

let files = fs
  .readdirSync(__dirname)
  .filter((f) => f.indexOf("index.js") === -1 && f.endsWith(".js"));

await Promise.all(
  files.map(async (f) => {
    let name = f.split(".")[0];
    try {
      mainMod[name] = await import(`./${f}`);
    } catch (e) {
      console.error(e);
    }
  })
);

// import Create from "./Create.js";
// import Update from "./Update.js";
// import Delete from "./Delete.js";
// import Like from "./Like.js";
// import Unlike from "./Unlike.js";
// import Add from "./Add.js";
// import Remove from "./Remove.js";
// import Approve from "./Approve.js";
// import Reject from "./Reject.js";
// import Join from "./Join.js";
// import Leave from "./Leave.js";
// import Block from "./Block.js";
// import Unblock from "./Unblock.js";
// import Mute from "./Mute.js";
// import Unmute from "./Unmute.js";
// import Reply from "./Reply.js";

// export default {
//   Create,
//   Update,
//   Delete,
//   Like,
//   Unlike,
//   Add,
//   Remove,
//   Approve,
//   Reject,
//   Join,
//   Leave,
//   Block,
//   Unblock,
//   Mute,
//   Unmute,
//   Reply,
// };

export default mainMod;
