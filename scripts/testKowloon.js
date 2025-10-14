// scripts/checkObjectId.js
import "dotenv/config"; // <-- loads MONGODB_URI / MONGO_URL before any other imports

import Kowloon from "../Kowloon.js";
console.log(await Kowloon.get.visibleCollection("user"));

process.exit(0);
