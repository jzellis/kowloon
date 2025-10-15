// scripts/checkObjectId.js
import "dotenv/config"; // <-- loads MONGODB_URI / MONGO_URL before any other imports

import Kowloon from "../Kowloon.js";

let response = await Kowloon.auth.login("admin", "12345");
console.log(response);
process.exit(0);
