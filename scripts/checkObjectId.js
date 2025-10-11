// scripts/checkObjectId.js
import "dotenv/config"; // <-- loads MONGODB_URI / MONGO_URL before any other imports

const { default: Kowloon } = await import("#kowloon"); // import *after* env is set

// If your API needs an explicit init, uncomment:
// await Kowloon.init();

const id = process.argv[2] || "@admin@kwln.org";
const result = await Kowloon.get.getObjectById(id, {
  // viewerId: '@admin@kwln.org',        // optional; omit => public-only visibility
  mode: "local", // keep local for this test
});

console.log(result);
process.exit(0);
