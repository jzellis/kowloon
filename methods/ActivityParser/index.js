import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainMod = {};

let files = fs
  .readdirSync(__dirname)
  .filter((f) => f.indexOf("index.js") === -1 && f.endsWith(".js"));

await Promise.all(
  files.map(async (f) => {
    let name = f.split(".")[0];
    try {
      let module = await import(`./${f}`);
      mainMod[name] = function (v) {
        return module.default(v);
      };
    } catch (e) {
      console.error(e);
    }
  })
);

export default mainMod;
