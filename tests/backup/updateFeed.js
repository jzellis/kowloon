import Kowloon from "../../Kowloon.js";

let items = await Kowloon.updateFeed("@admin@kwln.org");
console.log(items);
process.exit(0);
