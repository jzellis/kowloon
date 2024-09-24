import Kowloon from "../Kowloon.js";

await Kowloon.updateUserFeed("@admin@kowloon.social");
console.log(await Kowloon.getFeed("@admin@kowloon.social"));

process.exit(0);
