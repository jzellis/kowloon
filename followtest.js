import Kowloon from "./Kowloon.js";

let testUrls = [
  "https://kowloon.social/api/users/admin",
  "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  "https://kowloon.social/api/posts",
];

for (let url of testUrls) {
  console.log(await Kowloon.follow(url));
}
process.exit();
