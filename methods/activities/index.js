import create from "./create.js";
import get from "./get.js";
import list from "./list.js";
import ActivityParser from "#ActivityParser";
import validate from "./validate.js";

// Note: ActivityParser is async, so parse needs to be called as: await ActivityParser()
export default { create, get, list, parse: ActivityParser, validate };
