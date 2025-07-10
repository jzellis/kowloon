import Kowloon from "../../Kowloon.js";

let items = await Kowloon.updateFeed("@admin@kowloon.social");
console.log(items);
process.exit(0);
